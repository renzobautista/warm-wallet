import "../styles/globals.css"
import { Alert, AlertIcon, ChakraProvider } from "@chakra-ui/react";
import type { AppProps } from "next/app";
import React, { useEffect, useState } from "react";
import Web3 from 'web3'

const CONTRACT_CHAIN_ID = parseInt(process.env.CHAIN_ID ?? "0")

function MyApp({ Component, pageProps }: AppProps) {
  const [chainId, setChainId] = useState(CONTRACT_CHAIN_ID);
  let chainTimer: NodeJS.Timer;
  const web3: Web3 = new Web3(Web3.givenProvider);
  useEffect(() => {
    chainTimer = setInterval(() => {
      web3.eth.getChainId()
        .then(version => { setChainId(version); });
    }, 500);
  }, []);
  useEffect(() => { return () => { clearInterval(chainTimer); } }, []);

  return (
    <ChakraProvider>
      {chainId != CONTRACT_CHAIN_ID && (
        <Alert status="error">
          <AlertIcon />
          Please switch to network: {process.env.CHAIN_NAME}
        </Alert>
      )}
      <Component {...pageProps} />
    </ChakraProvider>
  )
}

export default MyApp
