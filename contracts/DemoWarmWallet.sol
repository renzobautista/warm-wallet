// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

contract DemoWarmWallet {
    enum Role { UNAUTHORIZED, MEMBER, ADMIN }

    // Roles for each address. Default is UNAUTHORIZED.
    mapping (address => Role) roles;

    // How much user spent on given day.
    mapping (uint => uint) dailySpend;

    // Nonce to prevent replay attacks.
    uint public nonce;

    // Single transaction limit.
    // TODO(renzo): Rule for general transactions.
    uint public transactionLimit;
    
    // Daily transaction limit.
    uint public dailyLimit;

    constructor(address _admin, address _member, uint _transactionLimit, uint _dailyLimit) {
        require(transactionLimit >= 0 && dailyLimit >= 0 && _admin != _member);
        roles[_admin] = Role.ADMIN;
        roles[_member] = Role.MEMBER;
        transactionLimit = _transactionLimit;
        dailyLimit = _dailyLimit;
    }

    modifier onlyAdmin {
        require(roles[msg.sender] == Role.ADMIN);
        _;
    }

    modifier approvalsMet(uint value) {
        require(roles[msg.sender] != Role.UNAUTHORIZED);
        require(roles[msg.sender] == Role.ADMIN || !requiresAdminApproval(value));
        _;
    }

    function requiresAdminApproval(uint value) public view returns (bool) {
        if (transactionLimit > 0 && value > transactionLimit) {
            return true;
        }
        if (dailyLimit > 0 && dailySpend[today()] + value > dailyLimit) {
            return true;
        }
        return false;
    }

    // An execution triggered from a cold wallet. Goes through without checks for approval requirement.
    function execute(address destination, uint value, bytes memory data, uint gasLimit) external approvalsMet(value) {
        _execute(destination, value, data, gasLimit);
    }

    // Executes the wrapped transaction.
    function _execute(address destination, uint value, bytes memory data, uint gasLimit) private {
        nonce = nonce + 1;
        bool success = false;
        assembly { success := call(gasLimit, destination, value, add(data, 0x20), mload(data), 0, 0) }
        require(success);
        dailySpend[today()] += value;
    }

    // Ejects a member address from having authorization to this wallet.
    function eject(address _memberAddress) public onlyAdmin {
        require(roles[_memberAddress] == Role.MEMBER); // Makes sure address is not an ADMIN.
        roles[_memberAddress] = Role.UNAUTHORIZED;
    }

    // Adds a new member address to this wallet.
    function addMember(address _memberAddress) public onlyAdmin {
        require(roles[_memberAddress] == Role.UNAUTHORIZED);
        roles[_memberAddress] = Role.MEMBER;
    }

    // Two-in-one method to eject and add member.
    function replace(address _oldMember, address _newMember) external onlyAdmin {
        require(_oldMember != _newMember);
        eject(_oldMember);
        addMember(_newMember);
    }

    // Updates the single-transaction limit.
    function updateTransactionLimit(uint _newLimit) external onlyAdmin {
        require(_newLimit >= 0);
        transactionLimit = _newLimit;
    }

    // Updates the daily transaction limit.
    function updateDailyLimit(uint _newLimit) external onlyAdmin {
        require(_newLimit >= 0);
        dailyLimit = _newLimit;
    }

    // Approximation for "daily limits" using 1 day blocks starting from epoch.
    function today() view private returns (uint) {
        return block.timestamp / 1 days;
    }

    receive() external payable {}
}