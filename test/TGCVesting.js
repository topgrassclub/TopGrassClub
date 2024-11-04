const { expect } = require("chai");
const { ethers } = require("hardhat");
const helpers = require("@nomicfoundation/hardhat-network-helpers");


const getUnixTimestampInSeconds = (additionalSeconds = 0) => {
  let currentTimestampInSeconds = Math.floor(Date.now() / 1000);
  if(additionalSeconds > 0){
    currentTimestampInSeconds += additionalSeconds;
  }
  return currentTimestampInSeconds
}


describe("TGCVesting", () => {

  let vestingContract;
  let vesting;

  let tokenContract;
  let token;

  let owner;
  let beneficiary1;
  let beneficiary2;

  const MONTH_IN_SECONDS = 2629743;

  const TGE = getUnixTimestampInSeconds(MONTH_IN_SECONDS);


  beforeEach(async () => {
    await helpers.reset();

    [owner, beneficiary1, beneficiary2] = await ethers.getSigners();

    tokenContract = await ethers.getContractFactory("TGRASS");
    token = await tokenContract.deploy(owner);

    vestingContract = await ethers.getContractFactory("TGCVesting");
    vesting = await vestingContract.deploy(token, TGE);
  })

  describe('Deployment', () => {

    it('should create TGCVesting with specified values', async () => {
      let vestingTokenAddress = await vesting.getToken();
      let vestingTGETimestamp = await vesting.tgeTimestamp();
      await expect(vestingTokenAddress).to.equal(token);
      await expect(vestingTGETimestamp).to.equal(TGE);
    });

    it('should revert with null token address', async () => {
      await expect(vestingContract.deploy(ethers.ZeroAddress, TGE))
          .to.revertedWith("TGCVesting: Invalid token address.");
    });

    it('should revert with TGE equals to 0', async () => {
      await expect(vestingContract.deploy(token, 0))
          .to.revertedWith("TGCVesting: Invalid _tgeTimestamp.");
    });

      it('should set totalVested to 0', async () => {
          expect(await vesting.getTotalVested()).to.equal(0);
      });

  });

  describe('createVestingSchedule()', () => {

    it('should revert with empty name', async () => {
      await expect(vesting.createVestingSchedule("", 800, 1000, 1000, 5))
          .to.revertedWith("TGCVesting: vestingName cannot be empty.");
    });

    it('should revert when initialTGE is more than 1000', async () => {
         await expect(vesting.createVestingSchedule("test", 1100, 1000, 1000, 5))
             .to.revertedWith("TGCVesting: Invalid initialTGEReturn.");
    });

    it('should revert when vestingDuration is 0, but vestingPeriodsCount is not', async () => {
         await expect(vesting.createVestingSchedule("test", 900, 1000, 0, 5))
             .to.revertedWith("TGCVesting: Invalid vesting values.");
    });

    it('should revert when vestingPeriodsCount is 0, but vestingDuration is not', async () => {
         await expect(vesting.createVestingSchedule("test", 900, 1000, 1000, 0))
             .to.revertedWith("TGCVesting: Invalid vesting values.");
    });

    it('should revert if initialTGE is not 1000, but cliffDuration and vestingDuration are 0', async () => {
         await expect(vesting.createVestingSchedule("test", 900, 0, 0, 0))
             .to.revertedWith("TGCVesting: Invalid vesting schedule settings.");
    });

    it('should revert if vestingDuration is not 0 and vestingPeriod is bigger than vestingDuration', async () => {
         await expect(vesting.createVestingSchedule("test", 900, 0, 10, 100))
             .to.revertedWith("TGCVesting: Invalid vesting schedule settings.");
    });

    it('should create VestingSchedule with provided data', async () => {
      await vesting.createVestingSchedule("test", 100, MONTH_IN_SECONDS * 3 , MONTH_IN_SECONDS * 4, 4);
      const vestingScheduleData = await vesting.getVestingScheduleDetails("test");
      expect(vestingScheduleData.initialTGEReturn).to.equal(100);
      expect(vestingScheduleData.cliffDuration).to.equal(MONTH_IN_SECONDS * 3);
      expect(vestingScheduleData.vestingDuration).to.equal(MONTH_IN_SECONDS * 4);
      expect(vestingScheduleData.vestingPeriodsCount).to.equal(4);
      expect(vestingScheduleData.exist).to.equal(true);
    });

    it('should emit VestingScheduleCreated event', async () => {
      await expect(vesting.createVestingSchedule("test", 100, MONTH_IN_SECONDS * 3, MONTH_IN_SECONDS * 4, 4))
          .to.emit(vesting, "VestingScheduleCreated").withArgs("test");
    });

    it('should revert if not owner wants to create vesting schedule', async () => {
      await expect(vesting.connect(beneficiary1).createVestingSchedule("test", 900, 1000, 1000, 0))
          .to.reverted;
    });

    it('should revert if name is not unique', async () => {
      await vesting.createVestingSchedule("test", 100, MONTH_IN_SECONDS * 3 , MONTH_IN_SECONDS * 4, 4);
      await expect(vesting.createVestingSchedule("test", 100, MONTH_IN_SECONDS * 3 , MONTH_IN_SECONDS * 4, 4))
          .to.revertedWith("TGCVesting: Vesting name is not unique.");
    });
  });

  describe('createBeneficiaries()', () => {

    beforeEach(async () => {
      await token.approve(vesting, ethers.parseEther("100000000"));
      await token.transfer(vesting, ethers.parseEther("100000000"));
      await vesting.createVestingSchedule("test", 100,MONTH_IN_SECONDS * 3 , MONTH_IN_SECONDS * 4, 4);
    })

    it('should revert whole state if reverted after adding beneficiary', async () => {
      const beneficiaries = [
        {"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("50000000")},
        {"walletAddress": beneficiary2.address, "initialBalance": ethers.parseEther("100000000")},
      ]
      await expect(vesting.createBeneficiaries("test", beneficiaries)).to.revertedWith("TGCVesting: Insufficient funds");

      const beneficiaryBalance1 = await vesting.getInitialBalance("test", beneficiary1.address)
      const beneficiaryBalance2 = await vesting.getInitialBalance("test", beneficiary2.address)

      expect(beneficiaryBalance1).to.equal(0);
      expect(beneficiaryBalance2).to.equal(0);
    });

    it('should add beneficiaries to specified vesting schedule', async () => {
      const beneficiaries = [
        {"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("20000000")},
        {"walletAddress": beneficiary2.address, "initialBalance": ethers.parseEther("50000000")},
      ]
      const tx = await vesting.createBeneficiaries("test", beneficiaries);
      const receipt = await tx.wait();

      const beneficiaryBalance1 = await vesting.getInitialBalance("test", beneficiary1.address)
      const beneficiaryBalance2 = await vesting.getInitialBalance("test", beneficiary2.address)

      expect(beneficiaryBalance1).to.equal(ethers.parseEther("20000000"))
      expect(beneficiaryBalance2).to.equal(ethers.parseEther("50000000"))
      expect(receipt.length).to.equal(beneficiaries.length);
    });

    it('should revert if beneficiaries list is empty', async() => {
      const beneficiaries = [];
      await expect(vesting.createBeneficiaries("test", beneficiaries)).to.revertedWith("TGCVesting: Beneficiaries list is empty.")
    });

    it('should revert if vesting name is invalid', async() => {
      const beneficiaries = [
        {"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("20000000")},
        {"walletAddress": beneficiary2.address, "initialBalance": ethers.parseEther("50000000")},
      ]
      await expect(vesting.createBeneficiaries("test2", beneficiaries)).to.revertedWith("TGCVesting: VestingSchedule does not exist.")
    });

    it('should revert if beneficiary address is invalid', async () => {
      const beneficiaries = [
        {"walletAddress": ethers.ZeroAddress, "initialBalance": ethers.parseEther("20000000")},
        {"walletAddress": beneficiary2.address, "initialBalance": ethers.parseEther("50000000")},
      ]
      await expect(vesting.createBeneficiaries("test", beneficiaries)).to.revertedWith("TGCVesting: Invalid beneficiary address.")
    });

    it('should revert if beneficiary already exists', async () => {
      const beneficiaries = [
        {"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("20000000")},
        {"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("50000000")},
      ]
      await expect(vesting.createBeneficiaries("test", beneficiaries)).to.revertedWith("TGCVesting: Beneficiary already exist.")
    });

    it('should revert if beneficiary InitialBalance is equal 0', async () => {
      const beneficiaries = [
        {"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("20000000")},
        {"walletAddress": beneficiary2.address, "initialBalance": 0},
      ]
      await expect(vesting.createBeneficiaries("test", beneficiaries)).to.revertedWith("TGCVesting: Initial beneficiary balance cannot be 0.")
    });

    it('should revert if owner is trying to deposit', async () => {
      const beneficiaries = [
        {"walletAddress": owner.address, "initialBalance": ethers.parseEther("20000000")},
      ]
      await expect(vesting.createBeneficiaries("test", beneficiaries)).to.revertedWith("TGCVesting: Owner cannot deposit into vesting.")
    });

    it('should revert if beneficiary tries to exceed token pool', async () => {
      const beneficiaries = [
        {"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("200000000")},
      ]
      await expect(vesting.createBeneficiaries("test", beneficiaries)).to.revertedWith("TGCVesting: Insufficient funds")
    });

    it('should emit BeneficiaryCreated event', async () => {
      const beneficiaries = [
        {"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("20000000")},
      ]
      await expect(vesting.createBeneficiaries("test", beneficiaries))
      .to.emit(vesting, "BeneficiaryCreated").withArgs(beneficiary1.address, ethers.parseEther("20000000"), "test");

    });
  });

  describe('withdraw()', () => {
    beforeEach(async () => {
      await vesting.createVestingSchedule("test", 100, MONTH_IN_SECONDS * 3, MONTH_IN_SECONDS * 4, 4);
      await token.approve(vesting, ethers.parseEther("100000000"));
      await token.transfer(vesting, ethers.parseEther("100000000"));
      const beneficiaries = [{"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("100000000")}]
      await vesting.createBeneficiaries("test", beneficiaries);
    })

    it('should revert if user is trying to withdraw before TGE', async () => {
      await expect(vesting.connect(beneficiary1).withdraw("test")).to.revertedWith("TGCVesting: Cannot release tokens yet.");
    });

    it('should revert is name of vesting schedule is invalid', async () => {
       await expect(vesting.connect(beneficiary1).withdraw("test2")).to.revertedWith("TGCVesting: VestingSchedule does not exist.");
    });

    it('should revert if user is not in vestingSchedule stored address', async () => {
       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 10)
       await helpers.mine();
       await expect(vesting.connect(beneficiary2).withdraw("test")).to.revertedWith("TGCVesting: Invalid beneficiary.");
    });

    it('should revert if beneficiary current balance is 0', async () => {
       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 10)
       await helpers.mine();
       await vesting.connect(beneficiary1).withdraw("test");
       await expect(vesting.connect(beneficiary1).withdraw("test")).to.revertedWith("TGCVesting: Balance is already withdrawn.");
    });

    it('should revert if beneficiary already withdrawn', async () => {
       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 4)
       await helpers.mine();
       await vesting.connect(beneficiary1).withdraw("test");
       await expect(vesting.connect(beneficiary1).withdraw("test")).to.revertedWith("TGCVesting: Beneficiary do not have tokens to withdraw.");
    });

    it('should emit VestingWithdraw event', async () => {
       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 4)
       await helpers.mine();

       const withdrawableAmount = await vesting.getAmountAvailableToWithdraw("test", beneficiary1.address);

       await expect(vesting.connect(beneficiary1).withdraw("test"))
         .to.emit(vesting, "VestingWithdraw").withArgs("test", withdrawableAmount, beneficiary1.address);
    });

    it('should emit transfer tokens to beneficiary account', async () => {
       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 4)
       await helpers.mine();

       const withdrawableAmount = await vesting.getAmountAvailableToWithdraw("test", beneficiary1.address);
       await vesting.connect(beneficiary1).withdraw("test");

       expect(withdrawableAmount).to.equal(await token.balanceOf(beneficiary1.address))
    });
 });

  describe('getWithdrawableAmount()', () => {
     beforeEach(async () => {
       await vesting.createVestingSchedule("test", 100, MONTH_IN_SECONDS * 3, MONTH_IN_SECONDS * 4, 4);
       await token.approve(vesting, ethers.parseEther("100000000"));
       await token.transfer(vesting, ethers.parseEther("100000000"));
       const beneficiaries = [{"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("100000000")}]
       await vesting.createBeneficiaries("test", beneficiaries);
     })

     it('should revert is name of vesting schedule is invalid', async () => {
       await expect(vesting.getWithdrawableAmount("test5", beneficiary1.address)).to.revertedWith("TGCVesting: VestingSchedule does not exist.");
     });

     it('should return beneficiary InitialBalance', async () => {
       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 10)
       await helpers.mine();
       const withdrawableAmount = await vesting.getWithdrawableAmount("test", beneficiary1.address);
       expect(withdrawableAmount).to.equal(ethers.parseEther("100000000"));
     });
  });

  describe('getAmountAvailableToWithdraw()', () => {

    beforeEach(async () => {
      await vesting.createVestingSchedule("test", 100, MONTH_IN_SECONDS * 3, MONTH_IN_SECONDS * 4, 4);
      await token.approve(vesting, ethers.parseEther("100000000"));
      await token.transfer(vesting, ethers.parseEther("100000000"));
      const beneficiares = [{"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("100000000")}]
      await vesting.createBeneficiaries("test", beneficiares);
    })

    it('should return 0 if address initial balance is 0', async () => {
      const withdrawAmount = await vesting.getAmountAvailableToWithdraw("test", owner.address);
      expect(withdrawAmount).to.equal(0);
    });


    it('should revert if vesting with provided name do not exist', async () => {
      await expect(vesting.getAmountAvailableToWithdraw("test2", beneficiary1.address)).to.revertedWith('TGCVesting: VestingSchedule does not exist.');
    });

    it('should return only initial TGE tokens if cliff has not ended', async () => {
       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 3)
       await helpers.mine();
       const withdrawableAmount = await vesting.getAmountAvailableToWithdraw("test", beneficiary1.address);
       expect(withdrawableAmount).to.equal(ethers.parseEther("10000000"));
    });

    it('should return whole balance if vesting duration was specified as 0 and cliff ended', async () => {
       await vesting.createVestingSchedule("test2", 100, MONTH_IN_SECONDS * 3, 0, 0)
       await token.approve(vesting, ethers.parseEther("100000000"));
       await token.transfer(vesting, ethers.parseEther("100000000"));;
       const beneficiares = [{"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("100000000")}]
       await vesting.createBeneficiaries("test2", beneficiares);

       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 10)
       await helpers.mine();

       const withdrawableAmount = await vesting.getAmountAvailableToWithdraw("test2", beneficiary1.address);

       expect(withdrawableAmount).to.equal(ethers.parseEther("100000000"));
    });

    it('should return valid value to withdraw in every period of vesting', async () => {
       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 10)
       await helpers.mine();

       const withdrawableAmount = await vesting.getAmountAvailableToWithdraw("test", beneficiary1.address);
       expect(withdrawableAmount).to.equal(ethers.parseEther("100000000"));
    });

    it('should return full balance after vesting duration passed', async () => {
       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 10)
       await helpers.mine();

       const withdrawableAmount = await vesting.getAmountAvailableToWithdraw("test", beneficiary1.address);
       expect(withdrawableAmount).to.equal(ethers.parseEther("100000000"));
    });

    it('should return valid value to withdraw in valid period', async () => {
       const VALUE_PER_PERIOD = ethers.parseEther("90000000") / ethers.toBigInt(4)

       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 3)
       await helpers.mine();


       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 4)
       await helpers.mine();
       const withdrawFirstPeriod = await vesting.getAmountAvailableToWithdraw("test", beneficiary1.address);

       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 5)
       await helpers.mine();
       const withdrawSecondPeriod = await vesting.getAmountAvailableToWithdraw("test", beneficiary1.address);

       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 6)
       await helpers.mine();
       const withdrawThirdPeriod = await vesting.getAmountAvailableToWithdraw("test", beneficiary1.address);

       await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 7)
       await helpers.mine();
       const withdrawFourthPeriod = await vesting.getAmountAvailableToWithdraw("test", beneficiary1.address);

       expect(withdrawFirstPeriod).to.equal(VALUE_PER_PERIOD + ethers.parseEther("10000000"));
       expect(withdrawSecondPeriod).to.equal(VALUE_PER_PERIOD * ethers.toBigInt(2) + ethers.parseEther("10000000"));
       expect(withdrawThirdPeriod).to.equal(VALUE_PER_PERIOD * ethers.toBigInt(3) + ethers.parseEther("10000000"));
       expect(withdrawFourthPeriod).to.equal(VALUE_PER_PERIOD * ethers.toBigInt(4) + ethers.parseEther("10000000"));
     });
   });

  describe('getWithdrawnAmount()', () => {
    beforeEach(async () => {
      await vesting.createVestingSchedule("test", 100,MONTH_IN_SECONDS * 3 , MONTH_IN_SECONDS * 4, 4);
      await token.approve(vesting, ethers.parseEther("100000000"));
      await token.transfer(vesting, ethers.parseEther("100000000"));
      const beneficiaries = [
        {"walletAddress": beneficiary1.address, "initialBalance": ethers.parseEther("50000000")},
        {"walletAddress": beneficiary2.address, "initialBalance": ethers.parseEther("50000000")},
      ]
      await vesting.createBeneficiaries("test", beneficiaries);
    });

    it('should revert if vesting schedule with provided name does not exist', async () => {
      await expect(vesting.getWithdrawnAmount("test2", beneficiary1.address)).to.revertedWith('TGCVesting: VestingSchedule does not exist.');
    });

    it('should return 0 if user did not withdrawn any funds', async () => {
      const beneficiaryAmountWithdrawn = await vesting.getWithdrawnAmount("test", beneficiary1.address)
      expect(beneficiaryAmountWithdrawn).to.equal(0);
    });

   it('should return valid amount', async () => {
      await helpers.time.setNextBlockTimestamp(TGE + MONTH_IN_SECONDS * 3)
      await helpers.mine();

      await vesting.connect(beneficiary1).withdraw("test");
      const beneficiaryAmountWithdrawn = await vesting.getWithdrawnAmount("test", beneficiary1.address)
      expect(beneficiaryAmountWithdrawn).to.equal(ethers.parseEther("5000000"));
    });
  });

  describe('getVestingScheduleDetails()', () => {
    it('should return vesting schedule details', async () => {
      await vesting.createVestingSchedule("test", 100, MONTH_IN_SECONDS * 3, MONTH_IN_SECONDS * 4, 4);

      const vestingSchedule = await vesting.getVestingScheduleDetails("test");
      expect(vestingSchedule.exist).to.equal(true);
      expect(vestingSchedule.initialTGEReturn).to.equal(100);
    });

    it('should revert if schedule do not exist', async () => {
      await expect(vesting.getVestingScheduleDetails("test")).to.be.revertedWith("TGCVesting: VestingSchedule does not exist.");
    });
  });
})