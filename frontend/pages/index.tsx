import { Button, VStack } from "@chakra-ui/react";
import type { NextPage } from "next";
import Link from "next/link";

const Home: NextPage = () => {
  return (
    <VStack spacing="24px">
      <Link href="/create">
        <Button>Create Wallet</Button>
      </Link>
      <Button>Login to Wallet</Button>
    </VStack>
  )
}

export default Home
