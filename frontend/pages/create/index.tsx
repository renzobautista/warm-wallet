import { useInterval } from "../../app/hooks";
import {
  Alert,
  AlertIcon,
  Button,
  Heading,
  Input,
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

  const web3: Web3 = new Web3(Web3.givenProvider);
  useInterval(() => {
    web3.eth.requestAccounts().then(accts => {
      if (accts.length > 0) {
        setCurrentAccount(accts[0]);
      }
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
    setErrors(errorList);
  }, [adminAddress, memberAddress, transactionLimit, dailyLimit, currentAccount]);

  const submit = () => {
    console.log("SUBMIT");
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
      <Button disabled={errors.length > 0} onClick={submit}>Create Wallet</Button>
    </VStack>
  )
}

export default Create
