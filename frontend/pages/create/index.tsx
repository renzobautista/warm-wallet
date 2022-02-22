import { WARM_WALLET_ADDRESS } from "../../app/cookies";
import { web3, factoryContract } from "../../app/web3utils";
import {
  Alert,
  AlertIcon,
  Button,
  Heading,
  Input,
  Text,
  useInterval,
  VStack
} from "@chakra-ui/react";
import type { NextPage } from "next";
import Router from 'next/router'
import { useEffect, useState } from "react";
import { withCookies } from 'react-cookie'

const Create: NextPage = ({ cookies }) => {
  const [adminAddress, setAdminAddress] = useState("");
  const [memberAddress, setMemberAddress] = useState("");
  const [transactionLimit, setTransactionLimit] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [errors, setErrors] = useState<Array<string>>([]);
  const [currentAccount, setCurrentAccount] = useState("");
  const [fee, setFee] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useInterval(() => {
    web3.eth.requestAccounts().then(accts => {
      if (accts.length > 0) {
        setCurrentAccount(accts[0]);
      }
    })
  }, 500);
  useInterval(() => {
    factoryContract.methods.fee().call().then((fee: any) => {
      setFee(web3.utils.fromWei(fee));
    })
  }, 500);

  useEffect(() => {
    let errorList: Array<string> = [];
    if (currentAccount === "") {
      errorList.push("No Ethereum accounts.")
      setErrors(errorList);
      return;
    }
    if (adminAddress.toLowerCase() != currentAccount.toLowerCase()) {
      errorList.push("Admin is not the current user.");
    }
    if (adminAddress.toLowerCase() === memberAddress.toLowerCase()) {
      errorList.push("Admin is the same as member.");
    }
    if (memberAddress === "") {
      errorList.push("Member is empty.");
    }
    if (transactionLimit === "") {
      errorList.push("Transaction limit is empty.")
    }
    if (dailyLimit === "") {
      errorList.push("Daily limit is empty.")
    }
    setErrors(errorList);
  }, [adminAddress, memberAddress, transactionLimit, dailyLimit, currentAccount]);

  const submit = () => {
    const transactionLimitWei = web3.utils.toWei(transactionLimit);
    const dailyLimitWei = web3.utils.toWei(dailyLimit);
    setSubmitted(true);
    factoryContract.methods.createWallet(adminAddress, memberAddress, transactionLimitWei, dailyLimitWei)
      .send({ from: adminAddress, value: web3.utils.toWei("1") })
      .on("receipt", (receipt: any) => {
        const walletAddr = receipt.events.NewWarmWallet.returnValues.walletAddr;
        cookies.set(WARM_WALLET_ADDRESS, walletAddr);
        Router.push("/dashboard")
      })
      .on("error", (error: any) => {
        console.log(error);
      });
  }

  return (
    <VStack spacing="24px">
      <Input
        placeholder="Admin address"
        onChange={e => { setAdminAddress(e.target.value) }}
        value={adminAddress}
      />
      <Input
        placeholder="Member address"
        onChange={e => { setMemberAddress(e.target.value) }}
        value={memberAddress}
      />
      <Input
        type="number"
        placeholder="Transaction limit (in ETH)"
        onChange={e => { Number(e.target.value) >= 0 && setTransactionLimit(e.target.value) }}
        value={transactionLimit}
      />
      <Input
        type="number"
        placeholder="Daily limit (in ETH)"
        onChange={e => { Number(e.target.value) >= 0 && setDailyLimit(e.target.value) }}
        value={dailyLimit}
      />
      {errors.length > 0 && (
        <VStack spacing="24px">
          <Heading>Errors</Heading>
          {errors.map(error => {
            return (
              <Alert status="error" key={error}>
                <AlertIcon />
                {error}
              </Alert>
            )
          })}
        </VStack>
      )}
      <Text>Fee: {fee} ETH</Text>
      <Button disabled={errors.length > 0 || submitted} onClick={submit}>Create Wallet</Button>
    </VStack>
  )
}

export default withCookies(Create)
