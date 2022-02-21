require('dotenv').config();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    CHAIN_ID: process.env.CHAIN_ID,
    CHAIN_NAME: process.env.CHAIN_NAME,
    FACTORY_CONTRACT_ADDRESS: process.env.FACTORY_CONTRACT_ADDRESS
  }
}
module.exports = nextConfig
