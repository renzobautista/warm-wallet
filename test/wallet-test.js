const { expect, use } = require("chai");
const chaiAsPromised = require('chai-as-promised');
const { ethers, waffle } = require("hardhat");
const { BigNumber } = require("@ethersproject/bignumber");

use(chaiAsPromised);

const TRANSACTION_LIMIT = 1000;
const DAILY_LIMIT = 2000;

describe("DemoWarmWallet", function () {
    async function setup() {
        const signers = await ethers.getSigners();
        const admin = signers[0];
        const member = signers[1];
        const unauthorized = signers[2];

        const DemoWarmWallet = await ethers.getContractFactory("DemoWarmWallet");
        const wallet = await DemoWarmWallet.deploy(admin.address, member.address, TRANSACTION_LIMIT, DAILY_LIMIT);
        await wallet.deployed();

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

    it("Admin can do any transaction size", async function () {
        const [admin, member, wallet] = await setup();
        const memberBalance = await waffle.provider.getBalance(member.address);
        await wallet.connect(admin).execute(member.address, TRANSACTION_LIMIT + 10, "0x", 100000);
        expect(await waffle.provider.getBalance(member.address)).equals(memberBalance.add(TRANSACTION_LIMIT + 10));
    });

    it("Member can do transaction size smaller than limit", async function () {
        const [admin, member, wallet] = await setup();
        const adminBalance = await waffle.provider.getBalance(admin.address);
        await wallet.connect(member).execute(admin.address, TRANSACTION_LIMIT - 10, "0x", 100000);
        expect(await waffle.provider.getBalance(admin.address)).equals(adminBalance.add(TRANSACTION_LIMIT - 10));
    });

    it("Member can do transaction size equal to limit", async function () {
        const [admin, member, wallet] = await setup();
        const adminBalance = await waffle.provider.getBalance(admin.address);
        await wallet.connect(member).execute(admin.address, TRANSACTION_LIMIT, "0x", 100000);
        expect(await waffle.provider.getBalance(admin.address)).equals(adminBalance.add(TRANSACTION_LIMIT));
    });

    it("Member cannot do transaction size greater than limit", async function () {
        const [admin, member, wallet] = await setup();
        await expect(wallet.connect(member).execute(admin.address, TRANSACTION_LIMIT + 10, "0x", 100000)).to.be.rejected;
    });

    it("Unauthorized cannot do transaction", async function () {
        const [admin, member, wallet, unauthorized] = await setup();
        await expect(wallet.connect(unauthorized).execute(admin.address, TRANSACTION_LIMIT + 10, "0x", 100000)).to.be.rejected;
    });

    it("Admin can do multiple transaction to go past daily limit", async function () {
        const [admin, member, wallet] = await setup();
        const memberBalance = await waffle.provider.getBalance(member.address);
        await wallet.connect(admin).execute(member.address, DAILY_LIMIT / 2, "0x", 100000);
        await wallet.connect(admin).execute(member.address, DAILY_LIMIT / 2 + 10, "0x", 100000);
        expect(await waffle.provider.getBalance(member.address)).equals(memberBalance.add(DAILY_LIMIT + 10));
    });

    it("Member cannot do multiple transaction to go past daily limit", async function () {
        const [admin, member, wallet] = await setup();
        const adminBalance = await waffle.provider.getBalance(admin.address);
        await wallet.connect(member).execute(admin.address, DAILY_LIMIT / 2, "0x", 100000);
        await expect(wallet.connect(member).execute(admin.address, DAILY_LIMIT / 2 + 10, "0x", 100000)).to.be.rejected;
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
        await expect(wallet.connect(member).execute(admin.address, TRANSACTION_LIMIT - 10, "0x", 100000)).to.be.rejected;
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
        await wallet.connect(unauthorized).execute(member.address, TRANSACTION_LIMIT - 10, "0x", 100000);
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
        await wallet.connect(unauthorized).execute(member.address, TRANSACTION_LIMIT - 10, "0x", 100000);
        expect(await waffle.provider.getBalance(member.address)).equals(memberBalance.add(TRANSACTION_LIMIT - 10));
        await expect(wallet.connect(member).execute(admin.address, TRANSACTION_LIMIT - 10, "0x", 100000)).to.be.rejected;
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
        await wallet.connect(member).execute(admin.address, TRANSACTION_LIMIT + 10, "0x", 100000);
        expect(await waffle.provider.getBalance(admin.address)).equals(adminBalance.add(TRANSACTION_LIMIT + 10));
    });

    it("0 daily limit ignores daily limit rule", async function() {
        const [admin, member, wallet] = await setup();
        await wallet.connect(admin).updateDailyLimit(0);
        const adminBalance = await waffle.provider.getBalance(admin.address);
        await wallet.connect(member).execute(admin.address, DAILY_LIMIT / 2, "0x", 100000);
        await wallet.connect(member).execute(admin.address, DAILY_LIMIT / 2, "0x", 100000);
        await wallet.connect(member).execute(admin.address, DAILY_LIMIT / 2, "0x", 100000);
        await wallet.connect(member).execute(admin.address, DAILY_LIMIT / 2, "0x", 100000);
        expect(await waffle.provider.getBalance(admin.address)).equals(adminBalance.add(DAILY_LIMIT * 2));
    });

});

// DONE admin can do any transaction size
// DONE member cannot do transaction size > transaction limit
// DONE member can do transaction size <= transaction limit
// DONE unauthorized cannot do transaction size <= transaction limit
// DONE admin can do multiple transaction to go past daily limit
// DONE member cannot do transaction to go past daily limit
// DONE admin can change transaction limit
// DONE member cannot change transaction limit
// DONE unauthorized cannot change transaction limit
// DONE admin can change daily limit
// DONE member cannot change daily limit
// DONE unauthorized cannot change daily limit
// DONE admin can eject member
// DONE admin cannot eject admin
// DONE member cannot eject member
// DONE unauthorized cannot eject member
// DONE admin can add member
// DONE admin cannot add admin to member
// DONE member cannot add member
// DONE unauthorized cannot add member
// 0 transaction limit ignores transaction limit rule
// 0 daily limit ignores daily limit rule