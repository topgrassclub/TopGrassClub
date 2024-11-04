// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract TGRASS is ERC20, Ownable, ERC20Permit, ERC20Burnable {
    constructor (address initialAddress)
        ERC20("Top Grass Club", "TGRASS")
        ERC20Permit("Top Grass Club")
        Ownable(initialAddress)
    {
        _mint(owner(), 800_000_000 * 10 ** decimals());
        emit TokensMinted(800_000_000 * 10 ** decimals());
    }

    function burn(uint256 value) public override {
        super.burn(value);
        emit TokensBurned(_msgSender(), value);
    }

    function burnFrom(address account, uint256 value) public override {
        super.burnFrom(account, value);
        emit TokensBurned(account, value);
    }

    // ---------- EVENTS ----------
    event TokensBurned(address account, uint256 amount);
    event TokensMinted(uint256 amount);
}
