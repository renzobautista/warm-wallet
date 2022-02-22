import { WARM_WALLET_ADDRESS } from "../../app/cookies";
import { web3, walletContract } from "../../app/web3utils";
import { Button, Divider, HStack, Input, Text, useInterval, VStack } from "@chakra-ui/react";
import type { NextPage } from "next";
import Link from "next/link";
import Router from "next/router";
import { useEffect, useState } from "react";
import { withCookies } from "react-cookie";
import { env } from "process";

const SALT = "0x65d55b653f260c74ea61ec761ba036f46d9ad02a0ebb14699b58d3fcda7fe2f0";
const DOMAIN = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
  { name: "salt", type: "bytes32" },
];
const WARM_WALLET_TRANSACTION = [
  { name: "destination", type: "address" },
  { name: "value", type: "uint256" },
  { name: "data", type: "bytes" },
  { name: "nonce", type: "uint256" },
  { name: "executor", type: "address" },
  { name: "gasLimit", type: "uint256" },
];

const Dashboard: NextPage = ({ cookies }) => {
  enum Role {
    UNAUTHORIZED,
    MEMBER,
    ADMIN
  }
  const [balance, setBalance] = useState("[Loading...]");
  const [transactionLimit, setTransactionLimit] = useState("[Loading...]");
  const [dailyLimit, setDailyLimit] = useState("[Loading...]");
  const [loadAmount, setLoadAmount] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [requiresAdminApproval, setRequiresAdminApproval] = useState(true);
  const [currentAccount, setCurrentAccount] = useState("");
  const [currentAccountRole, setCurrentAccountRole] = useState(Role.UNAUTHORIZED);
  const walletAddr = cookies.get(WARM_WALLET_ADDRESS);
  const contract = walletContract(walletAddr);

  useInterval(() => {
    if (walletAddr === undefined) {
      return;
    }
    web3.eth.getBalance(walletAddr).then(web3.utils.fromWei).then(setBalance);
  }, 1000);

  useEffect(() => {
    contract.methods.transactionLimit().call()
      .then(web3.utils.fromWei)
      .then(setTransactionLimit);
      contract.methods.dailyLimit().call()
      .then(web3.utils.fromWei)
      .then(setDailyLimit);
  }, []);

  useInterval(() => {
    web3.eth.requestAccounts()
      .then(accts => accts[0])
      .then(setCurrentAccount);
  }, 500);

  useEffect(() => {
    if (currentAccount === "") {
      return
    }
    contract.methods.role(currentAccount).call()
      .then((role: number) => setCurrentAccountRole(role));
  }, [currentAccount]);

  useEffect(() => {
    if (!parseFloat(sendAmount)) {
      return
    }
    const sendAmountWei = web3.utils.toWei(sendAmount);
    contract.methods.requiresAdminApproval(sendAmountWei).call()
      .then(setRequiresAdminApproval);
  }, [sendAmount]);

  function loadWallet() {
    if (walletAddr === undefined) {
      return;
    }
    if (parseFloat(loadAmount) <= 0) {
      return;
    }
    web3.eth.requestAccounts()
      .then(accounts => accounts[0])
      .then(account => {
        return web3.eth.sendTransaction({
          from: account,
          to: walletAddr,
          value: web3.utils.toWei(loadAmount)
        });
      });
  }

  function logout() {
    cookies.remove(WARM_WALLET_ADDRESS);
    Router.push("/");
  }

  function sendEth() {
    if (!parseFloat(sendAmount)) { return; }
    let sendAmountWei = web3.utils.toWei(sendAmount);
    Promise.all([contract.methods.nonce().call(), contract.methods.walletId().call()])
      .then(vals => {
        const [nonce, walletId] = vals;
        const txData = "0x";
        const gasLimit = 100000;
        const domainData = {
          name: "WarmWallet" + walletId,
          version: "1",
          chainId: parseInt(process.env.CHAIN_ID),
          verifyingContract: walletAddr,
          salt: SALT
        };
        const message = {
          destination: sendAddress,
          value: sendAmountWei,
          data: txData,
          nonce: web3.utils.toHex(nonce),
          executor: currentAccount,
          gasLimit: gasLimit
        }
        const data = JSON.stringify({
          types: {
              EIP712Domain: DOMAIN,
              WarmWalletTransaction: WARM_WALLET_TRANSACTION
          },
          domain: domainData,
          primaryType: "WarmWalletTransaction",
          message: message
        });
        web3.currentProvider.sendAsync(
          {
            method: "eth_signTypedData_v3",
            params: [currentAccount, data],
            from: currentAccount
          },
          (error, result) => {
            if (error) {
              console.log(error);
              return;
            }
            const signature = result.result.substring(2);
            const r = "0x" + signature.substring(0, 64);
            const s = "0x" + signature.substring(64, 128);
            const v = parseInt(signature.substring(128, 130), 16);
            contract.methods.execute(v, r, s, sendAddress, sendAmountWei, txData, gasLimit)
              .send({ from: currentAccount })
              .on("receipt", (receipt: any) => {
                console.log(receipt);
                setSendAmount("");
                setSendAddress("");
              })
              .on("error", (error: any) => {
                console.log(error);
              });
          }
        )
      });
  }

  function shouldAllowSend() {
    if (currentAccountRole == Role.UNAUTHORIZED) {
      return false;
    }
    if (currentAccountRole == Role.ADMIN) {
      return true;
    }
    if (currentAccountRole == Role.MEMBER) {
      return !requiresAdminApproval;
    }
    return false;
  }

  return (
    <VStack spacing="24px">
      <Text>Wallet dashboard</Text>
      <Text>Wallet address: {walletAddr}</Text>
      <Text>Current account: {currentAccount}</Text>
      <Text>Current account role: {Role[currentAccountRole]}</Text>
      <Text>Balance: { balance } ETH</Text>
      <Text>Transaction Limit: { transactionLimit } ETH</Text>
      <Text>Daily limit: { dailyLimit } ETH</Text>
      <Divider />
      <Text>Load this wallet</Text>
      <Input
        type="number"
        placeholder="Amount to load (in ETH)"
        onChange={e => { Number(e.target.value) >= 0 && setLoadAmount(e.target.value) }}
        value={loadAmount}
      />
      <Button onClick={loadWallet}>Load wallet</Button>
      <Divider />
      <Text>Send ETH</Text>
      <Input
        type="number"
        placeholder="Amount to send (in ETH)"
        onChange={e => { Number(e.target.value) >= 0 && setSendAmount(e.target.value) }}
        value={sendAmount}
      />
      <Input
        placeholder="To address"
        value={sendAddress}
        onChange={e => setSendAddress(e.target.value)}
      />
      <Button disabled={!shouldAllowSend()} onClick={sendEth}>Send transaction</Button>
      <Divider />
      <Button onClick={logout}>Logout</Button>
    </VStack>
  )
}

export default withCookies(Dashboard)
