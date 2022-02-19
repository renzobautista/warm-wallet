// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import "@openzeppelin/contracts/utils/Strings.sol";

contract WarmWallet {
    enum Role { UNAUTHORIZED, MEMBER, ADMIN }

    string constant WALLET_NAME_PREFIX = "WarmWallet";
    // EIP712 Precomputed hashes:
    // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)")
    bytes32 constant EIP712DOMAINTYPE_HASH = 0xd87cd6ef79d4e2b95e15ce8abf732db51ec771f1ca2edccf22a46c729ac56472;
    // keccak256("1")
    bytes32 constant VERSION_HASH = 0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6;
    // keccak256("WarmWalletTransaction(address destination,uint256 value,bytes data,uint256 nonce,address executor,uint256 gasLimit)")
    bytes32 constant TXTYPE_HASH = 0x3e9611591c3d8cab4405b947338195d6e8b31190db27c2ec1c0e85cfd67c7618;
    bytes32 constant SALT = 0x65d55b653f260c74ea61ec761ba036f46d9ad02a0ebb14699b58d3fcda7fe2f0;
    bytes32 NAME_HASH;
    bytes32 DOMAIN_SEPARATOR;

    // Roles for each address. Default is UNAUTHORIZED.
    mapping (address => Role) roles;

    // How much this wallet spent on each given day.
    mapping (uint => uint) dailySpend;

    // Nonce to prevent replay attacks.
    uint public nonce;

    // Single transaction limit.
    // TODO(renzo): Figure out rules for general transactions.
    uint public transactionLimit;
    
    // Daily transaction limit.
    uint public dailyLimit;

    constructor(address _admin, address _member, uint _transactionLimit, uint _dailyLimit, uint chainId, uint walletId) {
        require(transactionLimit >= 0 && dailyLimit >= 0 && _admin != _member);
        roles[_admin] = Role.ADMIN;
        roles[_member] = Role.MEMBER;
        transactionLimit = _transactionLimit;
        dailyLimit = _dailyLimit;
        // Hash of "WarmWallet" + walletId, e.g. "WarmWallet0".
        bytes32 nameHash = keccak256(abi.encodePacked(string(abi.encodePacked(WALLET_NAME_PREFIX, Strings.toString(walletId)))));
        NAME_HASH = nameHash;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            EIP712DOMAINTYPE_HASH,
            nameHash,
            VERSION_HASH,
            chainId,
            this,
            SALT
        ));
    }

    modifier onlyAdmin {
        require(roles[msg.sender] == Role.ADMIN, "Sender is not an ADMIN.");
        _;
    }

    modifier approvalsMet(uint value) {
        require(roles[msg.sender] != Role.UNAUTHORIZED, "Sender is UNAUTHORIZED.");
        require(roles[msg.sender] == Role.ADMIN || !requiresAdminApproval(value), "Message requires admin approval. Sender is not an ADMIN.");
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

    // Checks for requirements, then executes the wrapped transaction.
    function execute(
        uint8 sigV, bytes32 sigR, bytes32 sigS, address destination, uint value, bytes memory data, uint gasLimit
    ) external approvalsMet(value) {
        bytes32 txInputHash = keccak256(abi.encode(TXTYPE_HASH, destination, value, keccak256(data), nonce, msg.sender, gasLimit));
        bytes32 totalHash = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, txInputHash));
        address recovered = ecrecover(totalHash, sigV, sigR, sigS);
        require(recovered == msg.sender, "Sender did not sign the wrapped transaction.");

        nonce = nonce + 1;
        bool success = false;
        assembly { success := call(gasLimit, destination, value, add(data, 0x20), mload(data), 0, 0) }
        require(success, "Transaction failed.");
        dailySpend[today()] += value;
    }

    // Ejects a member address from having authorization to this wallet.
    function eject(address _memberAddress) public onlyAdmin {
        require(roles[_memberAddress] == Role.MEMBER, "Attempted to eject non-MEMBER."); // Makes sure address is not an ADMIN.
        roles[_memberAddress] = Role.UNAUTHORIZED;
    }

    // Adds a new member address to this wallet.
    function addMember(address _memberAddress) public onlyAdmin {
        require(roles[_memberAddress] == Role.UNAUTHORIZED, "Member is already not UNAUTHORIZED");
        roles[_memberAddress] = Role.MEMBER;
    }

    // Two-in-one method to eject and add member.
    function replace(address _oldMember, address _newMember) external onlyAdmin {
        require(_oldMember != _newMember, "Old member is the same as new member.");
        eject(_oldMember);
        addMember(_newMember);
    }

    // Updates the single-transaction limit.
    function updateTransactionLimit(uint _newLimit) external onlyAdmin {
        require(_newLimit >= 0, "New limit must be greater than or equal to 0.");
        transactionLimit = _newLimit;
    }

    // Updates the daily transaction limit.
    function updateDailyLimit(uint _newLimit) external onlyAdmin {
        require(_newLimit >= 0, "New limit must be greater than or equal to 0.");
        dailyLimit = _newLimit;
    }

    // Approximation for "daily limits" using 1 day blocks starting from epoch.
    function today() view private returns (uint) {
        return block.timestamp / 1 days;
    }

    receive() external payable {}
}