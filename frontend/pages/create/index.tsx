import WarmWalletFactory from "../../../artifacts/contracts/WarmWalletFactory.sol/WarmWalletFactory.json";
import { useInterval } from "../../app/hooks";
import {
  Alert,
  AlertIcon,
  Button,
  Heading,
  Input,
  Text,
  VStack
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import type { NextPage } from "next";
import Web3 from 'web3'

const Create: NextPage = () => {
  const [adminAddress, setAdminAddress] = useState("");
  const [memberAddress, setMemberAddress] = useState("");
  const [transactionLimit, setTransactionLimit] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [errors, setErrors] = useState<Array<string>>([]);
  const [currentAccount, setCurrentAccount] = useState("");
  const [fee, setFee] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const web3: Web3 = new Web3(Web3.givenProvider);
  const contractAddress: string = process.env.FACTORY_CONTRACT_ADDRESS ?? "";
  const contract = new web3.eth.Contract(WarmWalletFactory.abi, contractAddress);

  useInterval(() => {
    web3.eth.requestAccounts().then(accts => {
      if (accts.length > 0) {
        setCurrentAccount(accts[0]);
      }
    })
  }, 500);
  useInterval(() => {
    contract.methods.fee().call().then((fee: any) => {
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
    if (adminAddress != currentAccount) {
      errorList.push("Admin is not the current user.");
    }
    if (adminAddress === memberAddress) {
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
    if (contractAddress === "") {
      console.log("No deployed contract address");
      return
    }
    const transactionLimitWei = web3.utils.toWei(transactionLimit);
    const dailyLimitWei = web3.utils.toWei(dailyLimit);
    setSubmitted(true);
    contract.methods.createWallet(adminAddress, memberAddress, transactionLimitWei, dailyLimitWei)
      .send({ from: adminAddress, value: web3.utils.toWei("1") })
      .on("receipt", (receipt: any) => {
        console.log(receipt);
        console.log(receipt.events);
        const walletAddr = receipt.events.NewWarmWallet.returnValues.walletAddr;
        console.log(walletAddr);
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

export default Create
