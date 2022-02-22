import { WARM_WALLET_ADDRESS } from "../app/cookies";
import { Button, VStack } from "@chakra-ui/react";
import type { NextPage } from "next";
import Link from "next/link";
import Router from "next/router";
import { useEffect } from "react";
import { withCookies } from "react-cookie";

const Home: NextPage = ({ cookies }) => {
  useEffect(() => {
    let walletAddr: string | undefined = cookies.get(WARM_WALLET_ADDRESS);
    if (walletAddr != undefined) {
      Router.push("/dashboard");
    }
  }, []);

  return (
    <VStack spacing="24px">
      <Link href="/create">
        <Button>Create Wallet</Button>
      </Link>
      <Button>Login to Wallet</Button>
    </VStack>
  )
}

export default withCookies(Home)
