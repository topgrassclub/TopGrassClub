// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TGCVesting is Ownable, ReentrancyGuard{
    using SafeERC20 for IERC20;

    IERC20 private immutable _token;
    uint256 private immutable _tgeTimestamp;
    uint256 private _totalVested;

    constructor(address tokenAddress, uint256 tgeTimestamp_) Ownable(_msgSender()){
        require(tgeTimestamp_ > 0, "TGCVesting: Invalid _tgeTimestamp.");
        require(tokenAddress != address(0), "TGCVesting: Invalid token address.");
        _token = IERC20(tokenAddress);
        _tgeTimestamp = tgeTimestamp_;
        _totalVested = 0;
    }

    struct Beneficiary {
        address walletAddress;
        uint256 initialBalance;
    }

    struct VestingSchedule {
        uint64 vestingDuration;
        uint32 cliffDuration;
        uint32 vestingPeriodsCount;
        uint16 initialTGEReturn;
        bool exist;
    }

    // ---------- EVENTS ----------
    event VestingScheduleCreated(string vestingName);
    event VestingWithdraw(string vestingName, uint256 amount, address beneficiary);
    event BeneficiaryCreated(address beneficiaryAddress, uint256 initialBalance, string vestingName);

    mapping(bytes32 => VestingSchedule) private _vestingSchedules;
    mapping(bytes32 => mapping(address => uint256)) private _currentBalances;
    mapping(bytes32 => mapping(address => uint256)) private _initialBalances;

    /*
    @dev Function for creating VestingSchedule
    @param _vestingScheduleName - name of vesting schedule. Has to be unique
    @param _initialTGEReturn - initial promil of token return after TGE. Between 0 and 1000.
    @param _cliffDuration - duration in seconds of cliff period.
    @param _vestingDuration - duration in seconds of vesting period. Can be 0
    @param _vestingPeriodsCount - number of periods in vesting phase. Can be 0
    */
    function createVestingSchedule(string memory _vestingScheduleName, uint16 _initialTGEReturn, uint32 _cliffDuration, uint64 _vestingDuration, uint32 _vestingPeriodsCount) external onlyOwner{
        require(bytes(_vestingScheduleName).length > 0, "TGCVesting: vestingName cannot be empty.");
        require(_initialTGEReturn <= 1000, "TGCVesting: Invalid initialTGEReturn.");
        require((_vestingDuration == 0) == (_vestingPeriodsCount == 0), "TGCVesting: Invalid vesting values.");
        require(
            (_initialTGEReturn == 1000) || (_cliffDuration > 0) || ((_vestingDuration > 0) && (_vestingDuration > _vestingPeriodsCount)),
            "TGCVesting: Invalid vesting schedule settings."
        );

        bytes32 vestingScheduleID = keccak256(bytes(_vestingScheduleName));
        VestingSchedule memory vestingSchedule = _vestingSchedules[vestingScheduleID];
        require(!vestingSchedule.exist, "TGCVesting: Vesting name is not unique.");

        _vestingSchedules[vestingScheduleID] = VestingSchedule(
            _vestingDuration,
            _cliffDuration,
            _vestingPeriodsCount,
            _initialTGEReturn,
            true
        );

        emit VestingScheduleCreated(_vestingScheduleName);
    }

    /*
    @dev Adding beneficiaries into vesting schedule
    @param vestingScheduleName - name of vesting schedule
    @param beneficiaries - list of beneficiaries. Beneficiary object should have walletAddress and initialBalance.
    */
    function createBeneficiaries(string memory vestingScheduleName, Beneficiary[] memory beneficiaries) external onlyOwner{
        require(beneficiaries.length > 0, "TGCVesting: Beneficiaries list is empty.");
        bytes32 vestingScheduleID = vestingExists(vestingScheduleName);

        uint256 summedBalances = _totalVested;

        for(uint256 i = 0; i < beneficiaries.length; i++){
            require(beneficiaries[i].walletAddress != address(0), "TGCVesting: Invalid beneficiary address.");
            require(beneficiaries[i].initialBalance != 0, "TGCVesting: Initial beneficiary balance cannot be 0.");
            require(_initialBalances[vestingScheduleID][beneficiaries[i].walletAddress] == 0, "TGCVesting: Beneficiary already exist.");

            require(beneficiaries[i].walletAddress != owner(), "TGCVesting: Owner cannot deposit into vesting.");
            summedBalances += beneficiaries[i].initialBalance;

            require(summedBalances <= _token.balanceOf(address(this)), "TGCVesting: Insufficient funds");

            _currentBalances[vestingScheduleID][beneficiaries[i].walletAddress] = beneficiaries[i].initialBalance;
            _initialBalances[vestingScheduleID][beneficiaries[i].walletAddress] = beneficiaries[i].initialBalance;
            emit BeneficiaryCreated(beneficiaries[i].walletAddress,beneficiaries[i].initialBalance, vestingScheduleName);
        }

        _totalVested = summedBalances;
    }

    /*
    @dev Function to withdraw tokens
    @param vestingScheduleName - name of vesting schedule
    */
    function withdraw(string memory vestingScheduleName) external nonReentrant{
        bytes32 vestingScheduleID = vestingExists(vestingScheduleName);
        address sender = _msgSender();
        require(block.timestamp >= _tgeTimestamp, "TGCVesting: Cannot release tokens yet.");

        require(_initialBalances[vestingScheduleID][sender] > 0, "TGCVesting: Invalid beneficiary.");
        require(_currentBalances[vestingScheduleID][sender] > 0, "TGCVesting: Balance is already withdrawn.");

        uint256 amountToWithdraw = getWithdrawableAmount(vestingScheduleName, sender);

        require(amountToWithdraw > 0, "TGCVesting: Beneficiary do not have tokens to withdraw.");
        require(_currentBalances[vestingScheduleID][sender] >= amountToWithdraw, "TGCVesting: Amount to withdraw is bigger than current balance.");

        _currentBalances[vestingScheduleID][sender] -= amountToWithdraw;
        emit VestingWithdraw(vestingScheduleName, amountToWithdraw, sender);

        _token.safeTransfer(sender, amountToWithdraw);
    }

    /*
    @dev Function returns amount that is possible to withdraw by user
    */
    function getWithdrawableAmount(string memory vestingScheduleName, address beneficiary) public view returns (uint256) {
        vestingExists(vestingScheduleName);
        return getAmountAvailableToWithdraw(vestingScheduleName, beneficiary) - getWithdrawnAmount(vestingScheduleName, beneficiary);
    }

    /*
    @dev Function returns amount that beneficiary already withdrawn
    */
    function getWithdrawnAmount(string memory vestingScheduleName, address beneficiary) public view returns (uint256){
        bytes32 vestingScheduleID = vestingExists(vestingScheduleName);
        return _initialBalances[vestingScheduleID][beneficiary] - _currentBalances[vestingScheduleID][beneficiary];
    }

    /*
    @dev Function returns amount that is possible to withdraw by user in current time.
    */
    function getAmountAvailableToWithdraw(string memory vestingScheduleName, address beneficiary) public view returns (uint256){
        bytes32 vestingScheduleID = vestingExists(vestingScheduleName);
        VestingSchedule memory vestingSchedule = _vestingSchedules[vestingScheduleID];

        if (_initialBalances[vestingScheduleID][beneficiary] == 0 || block.timestamp < _tgeTimestamp) {
            return 0;
        }

        uint256 availablePromileToBeWithdrawn = vestingSchedule.initialTGEReturn;
        uint256 cliffEndTimestamp = _tgeTimestamp + vestingSchedule.cliffDuration;

        if(block.timestamp > cliffEndTimestamp){
            if(vestingSchedule.vestingDuration == 0){
                availablePromileToBeWithdrawn = 1000;
            }else{
                uint256 vestingPeriodInSeconds = vestingSchedule.vestingDuration / vestingSchedule.vestingPeriodsCount;
                uint256 currentVestingPeriodNumber = (block.timestamp - cliffEndTimestamp) / vestingPeriodInSeconds;
                availablePromileToBeWithdrawn += (1000 - vestingSchedule.initialTGEReturn) * currentVestingPeriodNumber / vestingSchedule.vestingPeriodsCount;
            }
        }

        if(availablePromileToBeWithdrawn >= 1000){
            return _initialBalances[vestingScheduleID][beneficiary];
        }

        return (availablePromileToBeWithdrawn * _initialBalances[vestingScheduleID][beneficiary]) / 1000;
    }

    /*
    @dev Function returns Token Generation Event timestamp
    */
    function tgeTimestamp() external view returns (uint256) {
        return _tgeTimestamp;
    }

    /*
    @dev Function returns token address
    */
    function getToken() external view returns (address) {
        return address(_token);
    }

    /*
    @dev Total Vested Tokens
    */
    function getTotalVested() external view returns (uint256) {
        return _totalVested;
    }

    /*
    @dev Balance of current address
    */
    function balance() external view returns (uint256) {
        return _token.balanceOf(address(this));
    }

    /*
    @dev Function returns vesting schedule details
    */
    function getVestingScheduleDetails(string memory vestingScheduleName) external view returns (VestingSchedule memory){
        bytes32 vestingScheduleID = vestingExists(vestingScheduleName);
        VestingSchedule memory vestingSchedule = _vestingSchedules[vestingScheduleID];
        return vestingSchedule;
    }

    /*
    @dev Function return initial balance for beneficiary in specified vesting schedule
    */
    function getInitialBalance(string memory vestingScheduleName, address beneficiary) external view returns (uint256){
        bytes32 vestingScheduleID = vestingExists(vestingScheduleName);
        return _initialBalances[vestingScheduleID][beneficiary];
    }

    /*
    @dev Function return current balance for beneficiary in specified vesting schedule
    */
    function getCurrentBalance(string memory vestingScheduleName, address beneficiary) external view returns (uint256){
        bytes32 vestingScheduleID = vestingExists(vestingScheduleName);
        return _currentBalances[vestingScheduleID][beneficiary];
    }

    /*
    @dev Function checks if Vesting with provided scheduleName already exists
    @return Hashed vestingScheduleName
    */
    function vestingExists(string memory vestingScheduleName) internal view returns (bytes32){
        bytes32 vestingScheduleID = keccak256(bytes(vestingScheduleName));
        require(_vestingSchedules[vestingScheduleID].exist, "TGCVesting: VestingSchedule does not exist.");
        return vestingScheduleID;
    }


}