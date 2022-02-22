import WarmWallet from "../../artifacts/contracts/WarmWallet.sol/WarmWallet.json";
import WarmWalletFactory from "../../artifacts/contracts/WarmWalletFactory.sol/WarmWalletFactory.json";
import Web3 from 'web3'

export const web3: Web3 = new Web3(Web3.givenProvider);
const contractAddress: string = process.env.FACTORY_CONTRACT_ADDRESS ?? "";
export const factoryContract = new web3.eth.Contract(WarmWalletFactory.abi, contractAddress);
export function walletContract(address: string) {
    return new web3.eth.Contract(WarmWallet.abi, address);
}