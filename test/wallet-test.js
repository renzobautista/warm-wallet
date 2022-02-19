const { expect, use } = require("chai");
const chaiAsPromised = require("chai-as-promised");
const { ethers, waffle } = require("hardhat");
const { BigNumber } = require("@ethersproject/bignumber");

use(chaiAsPromised);

const TRANSACTION_LIMIT = 1000;
const DAILY_LIMIT = 2000;

const SALT = "0x65d55b653f260c74ea61ec761ba036f46d9ad02a0ebb14699b58d3fcda7fe2f0";
const CHAIN_ID = 1;
const WALLET_ID = 0;
let DOMAIN;
const TRANSACTION_TYPES = {
    WarmWalletTransaction: [
        { name: "destination", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "nonce", type: "uint256" },
        { name: "executor", type: "address" },
        { name: "gasLimit", type: "uint256" },
    ]
}

const GAS_LIMIT = 100000;
const TX_DATA = "0x";

describe("WarmWallet", function () {
    async function setup() {
        const signers = await ethers.getSigners();
        const admin = signers[0];
        const member = signers[1];
        const unauthorized = signers[2];

        const WarmWallet = await ethers.getContractFactory("WarmWallet");
        const wallet = await WarmWallet.deploy(admin.address, member.address, TRANSACTION_LIMIT, DAILY_LIMIT, CHAIN_ID, WALLET_ID);
        await wallet.deployed();

        DOMAIN = {
            name: "WarmWallet" + WALLET_ID,
            version: "1",
            chainId: CHAIN_ID.toString(),
            verifyingContract: wallet.address,
            salt: SALT
        };
        
        expect(await waffle.provider.getBalance(wallet.address)).equals(0);
        await admin.sendTransaction({
            from: admin.address,
            to: wallet.address,
            value: BigNumber.from("5000000000000000"),
            nonce: await ethers.provider.getTransactionCount(admin.address, "latest"),
            gasLimit: 100000
        });
        expect(await waffle.provider.getBalance(wallet.address)).equals(BigNumber.from("5000000000000000"));

        return [admin, member, wallet, unauthorized];
    }

    async function executeTransaction(wallet, executor, destination, value) {
        let nonce = await wallet.nonce()
        const val = {
            destination: destination.address,
            value: value,
            data: TX_DATA,
            nonce: nonce.toHexString(),
            executor: executor.address,
            gasLimit: GAS_LIMIT
        }
        const signature = ethers.utils.splitSignature(await executor._signTypedData(DOMAIN, TRANSACTION_TYPES, val));

        const v = signature.v;
        const r = signature.r;
        const s = signature.s;
        await wallet.connect(executor).execute(v, r, s, destination.address, value, TX_DATA, GAS_LIMIT);
        expect(await wallet.nonce()).to.equal(nonce.add(1));
        return [v, r, s];
    }

    it("Admin can do any transaction size", async function () {
        const [admin, member, wallet] = await setup();
        const memberBalance = await waffle.provider.getBalance(member.address);
        await executeTransaction(wallet, admin, member, TRANSACTION_LIMIT + 10);
        expect(await waffle.provider.getBalance(member.address)).equals(memberBalance.add(TRANSACTION_LIMIT + 10));
    });

    it("Member can do transaction size smaller than limit", async function () {
        const [admin, member, wallet] = await setup();
        const adminBalance = await waffle.provider.getBalance(admin.address);
        await executeTransaction(wallet, member, admin, TRANSACTION_LIMIT - 10);
        expect(await waffle.provider.getBalance(admin.address)).equals(adminBalance.add(TRANSACTION_LIMIT - 10));
    });

    it("Member can do transaction size equal to limit", async function () {
        const [admin, member, wallet] = await setup();
        const adminBalance = await waffle.provider.getBalance(admin.address);
        await executeTransaction(wallet, member, admin, TRANSACTION_LIMIT);
        expect(await waffle.provider.getBalance(admin.address)).equals(adminBalance.add(TRANSACTION_LIMIT));
    });

    it("Member cannot do transaction size greater than limit", async function () {
        const [admin, member, wallet] = await setup();
        await expect(executeTransaction(wallet, member, admin, TRANSACTION_LIMIT + 10)).to.be.rejected;
    });

    it("Unauthorized cannot do transaction", async function () {
        const [admin, member, wallet, unauthorized] = await setup();
        await expect(executeTransaction(wallet, unauthorized, admin, TRANSACTION_LIMIT - 10)).to.be.rejected;
    });

    it("Admin can do multiple transaction to go past daily limit", async function () {
        const [admin, member, wallet] = await setup();
        const memberBalance = await waffle.provider.getBalance(member.address);
        await executeTransaction(wallet, admin, member, DAILY_LIMIT / 2);
        await executeTransaction(wallet, admin, member, DAILY_LIMIT / 2 + 10);
        expect(await waffle.provider.getBalance(member.address)).equals(memberBalance.add(DAILY_LIMIT + 10));
    });

    it("Member cannot do multiple transaction to go past daily limit", async function () {
        const [admin, member, wallet] = await setup();
        const adminBalance = await waffle.provider.getBalance(admin.address);
        await executeTransaction(wallet, member, admin, DAILY_LIMIT / 2);
        await expect(executeTransaction(wallet, member, admin, DAILY_LIMIT / 2 + 10)).to.be.rejected
        expect(await waffle.provider.getBalance(admin.address)).equals(adminBalance.add(DAILY_LIMIT / 2));
    });

    it("Admin can change transaction limit", async function() {
        const [admin, member, wallet] = await setup();
        expect(await wallet.transactionLimit()).equals(TRANSACTION_LIMIT);
        await wallet.connect(admin).updateTransactionLimit(TRANSACTION_LIMIT + 10);
        expect(await wallet.transactionLimit()).equals(TRANSACTION_LIMIT + 10);
    });

    it("Member cannot change transaction limit", async function() {
        const [admin, member, wallet] = await setup();
        expect(await wallet.transactionLimit()).equals(TRANSACTION_LIMIT);
        await expect(wallet.connect(member).updateTransactionLimit(TRANSACTION_LIMIT + 10)).to.be.rejected;
    });

    it("Unauthorized cannot change transaction limit", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        expect(await wallet.transactionLimit()).equals(TRANSACTION_LIMIT);
        await expect(wallet.connect(unauthorized).updateTransactionLimit(TRANSACTION_LIMIT + 10)).to.be.rejected;
    });

    it("Admin can change daily limit", async function() {
        const [admin, member, wallet] = await setup();
        expect(await wallet.dailyLimit()).equals(DAILY_LIMIT);
        await wallet.connect(admin).updateDailyLimit(DAILY_LIMIT + 10);
        expect(await wallet.dailyLimit()).equals(DAILY_LIMIT + 10);
    });

    it("Member cannot change daily limit", async function() {
        const [admin, member, wallet] = await setup();
        expect(await wallet.dailyLimit()).equals(DAILY_LIMIT);
        await expect(wallet.connect(member).updateDailyLimit(DAILY_LIMIT + 10)).to.be.rejected;
    });

    it("Unauthorized cannot change daily limit", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        expect(await wallet.dailyLimit()).equals(DAILY_LIMIT);
        await expect(wallet.connect(unauthorized).updateDailyLimit(DAILY_LIMIT + 10)).to.be.rejected;
    });

    it("Admin can eject member", async function() {
        const [admin, member, wallet] = await setup();
        await wallet.connect(admin).eject(member.address);
        await expect(executeTransaction(wallet, member, admin, TRANSACTION_LIMIT - 10)).to.be.rejected;
    });

    it("Admin cannot eject admin", async function() {
        const [admin, member, wallet] = await setup();
        await expect(wallet.connect(admin).eject(admin.address)).to.be.rejected;
    });

    it("Member cannot eject member", async function() {
        const [admin, member, wallet] = await setup();
        await expect(wallet.connect(member).eject(member.address)).to.be.rejected;
    });

    it("Unauthorized cannot eject member", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        await expect(wallet.connect(unauthorized).eject(member.address)).to.be.rejected;
    });

    it("Admin can add member", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        await wallet.connect(admin).addMember(unauthorized.address);
        const memberBalance = await waffle.provider.getBalance(member.address);
        await executeTransaction(wallet, unauthorized, member, TRANSACTION_LIMIT - 10);
        expect(await waffle.provider.getBalance(member.address)).equals(memberBalance.add(TRANSACTION_LIMIT - 10));
    });

    it("Admin cannot change admin to member", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        await expect(wallet.connect(admin).addMember(admin.address)).to.be.rejected;
    });

    it("Member cannot add member", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        await expect(wallet.connect(member).addMember(unauthorized.address)).to.be.rejected;
    });

    it("Unauthorized cannot add member", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        await expect(wallet.connect(unauthorized).addMember(unauthorized.address)).to.be.rejected;
    });

    it("Admin can replace", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        await wallet.connect(admin).replace(member.address, unauthorized.address);
        const memberBalance = await waffle.provider.getBalance(member.address);
        await executeTransaction(wallet, unauthorized, member, TRANSACTION_LIMIT - 10);
        expect(await waffle.provider.getBalance(member.address)).equals(memberBalance.add(TRANSACTION_LIMIT - 10));
        await expect(executeTransaction(member, admin, TRANSACTION_LIMIT - 10)).to.be.rejected
    });

    it("Admin cannot replace self", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        await expect(wallet.connect(admin).replace(admin.address, unauthorized.address)).to.be.rejected;
    });

    it("Member cannot replace self", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        await expect(wallet.connect(member).replace(member.address, unauthorized.address)).to.be.rejected;
    });

    it("Unauthorized cannot replace self", async function() {
        const [admin, member, wallet, unauthorized] = await setup();
        await expect(wallet.connect(unauthorized).replace(member.address, unauthorized.address)).to.be.rejected;
    });

    it("0 transaction limit ignores transaction limit rule", async function() {
        const [admin, member, wallet] = await setup();
        await wallet.connect(admin).updateTransactionLimit(0);
        const adminBalance = await waffle.provider.getBalance(admin.address);
        await executeTransaction(wallet, member, admin, TRANSACTION_LIMIT + 10);
        expect(await waffle.provider.getBalance(admin.address)).equals(adminBalance.add(TRANSACTION_LIMIT + 10));
    });

    it("0 daily limit ignores daily limit rule", async function() {
        const [admin, member, wallet] = await setup();
        await wallet.connect(admin).updateDailyLimit(0);
        const adminBalance = await waffle.provider.getBalance(admin.address);
        await executeTransaction(wallet, member, admin, DAILY_LIMIT / 2);
        await executeTransaction(wallet, member, admin, DAILY_LIMIT / 2);
        await executeTransaction(wallet, member, admin, DAILY_LIMIT / 2);
        await executeTransaction(wallet, member, admin, DAILY_LIMIT / 2);
        expect(await waffle.provider.getBalance(admin.address)).equals(adminBalance.add(DAILY_LIMIT * 2));
    });

    it("Transaction should not be subject to replay attack.", async function () {
        const [admin, member, wallet] = await setup();
        const memberBalance = await waffle.provider.getBalance(member.address);
        let [v, r, s] = await executeTransaction(wallet, admin, member, TRANSACTION_LIMIT + 10);
        expect(await waffle.provider.getBalance(member.address)).equals(memberBalance.add(TRANSACTION_LIMIT + 10));
        await expect(wallet.connect(admin).execute(v, r, s, member.address, TRANSACTION_LIMIT + 10, TX_DATA, GAS_LIMIT)).to.be.rejected;
    });
});
