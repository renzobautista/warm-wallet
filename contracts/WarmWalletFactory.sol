// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "./WarmWallet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WarmWalletFactory is Ownable {
    uint chainId;
    uint fee;
    address[] wallets;
    mapping (address => address) walletCreator;

    constructor(uint _chainId, uint _fee) Ownable() {
        chainId = _chainId;
        fee = _fee;
    }

    function createWallet(
        address _admin, address _member, uint _transactionLimit, uint _dailyLimit
    ) external payable returns (WarmWallet walletAddress) {
        require(msg.sender == _admin, "Only initial admin can create warm wallet.");
        require(msg.value >= fee, "msg.value is less than required fee.");

        WarmWallet wallet = new WarmWallet(_admin, _member, _transactionLimit, _dailyLimit, chainId, wallets.length);

        address walletAddr = address(wallet);
        wallets.push(walletAddr);
        walletCreator[walletAddr] = msg.sender;

        return wallet;
    }

    function updateFee(uint _fee) external onlyOwner {
        require(_fee >= 0, "Fee must be greater than or equal to 0.");
        fee = _fee;
    }

    function withdrawAll() external onlyOwner {
        address payable _owner = payable(owner());
        _owner.transfer(address(this).balance);
    }

    function withdrawAmount(uint amount) external onlyOwner {
        require(amount <= address(this).balance);
        address payable _owner = payable(owner());
        _owner.transfer(amount);
    }
}