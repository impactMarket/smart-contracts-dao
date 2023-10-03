import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DeployFunction} from "hardhat-deploy/types";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {deployments, ethers} from "hardhat";
import {createProposal, toEther} from "../../../test/utils/helpers";
import * as ethersTypes from "ethers";
import {getExchangePathProd} from "../../../test/utils/uniswap";

const {deploy} = deployments;
let deployer: SignerWithAddress;

// mainnet
const governanceDelegatorAddress = "0x8f8BB984e652Cb8D0aa7C9D6712Ec2020EB1BAb4";
const treasuryAddress = "0xa302dd52a4a85e6778E6A64A0E5EB0e8C76463d6";
const cUSDAddress = "0x765de816845861e75a25fca122bb6898b8b1282a";
const uniswapNFTPositionManagerId = 3108;
const PACTAddress = "0x46c9757C5497c5B1f2eb73aE79b6B67D119B0B58";
const donationMinerProxyAddress = "0x1C51657af2ceBA3D5492bA0c5A17E562F7ba6593";
const proxyAdminAddress = "0xFC641CE792c242EACcD545B7bee2028f187f61EC";


//alfajores
// const governanceDelegatorAddress = "0x5c27e2600a3eDEF53DE0Ec32F01efCF145419eDF";
// const treasuryAddress = "0xB0deEE097B5227C5E6bbE787665e4e62b4fE85f3";
// const cUSDAddress = "0x874069fa1eb16d44d622f2e0ca25eea172369bc1";
// const uniswapNFTPositionManagerId = 13739;
// const PACTAddress = "0x73A2De6A8370108D43c3C80430C84c30df323eD2";
// const donationMinerProxyAddress = "0x09Cdc8f50994F63103bc165B139631A6ad18EF49";
// const proxyAdminAddress = "0x79f9ca5f1A01e1768b9C24AD37FF63A0199E3Fe5";

let newDonationMinerImplementationAddress: string;


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // @ts-ignore
  // const { deployments, ethers } = hre;

  const accounts: SignerWithAddress[] = await ethers.getSigners();
  deployer = accounts[0];

  await deployNewDonationMinerImplementation();
  await createCallProposal();
};

async function deployNewDonationMinerImplementation() {
  console.log("Deploying new DonationMinerImplementation");
  newDonationMinerImplementationAddress = (
    await deploy('DonationMinerImplementation', {
      from: deployer.address,
      args: [],
      log: true,
    })
  ).address;
}

async function createCallProposal() {
  console.log("Creating new proposal");

  await createProposal(
    governanceDelegatorAddress,
    deployer,
    [
      proxyAdminAddress,
      donationMinerProxyAddress,
      treasuryAddress,
    ],
    [0, 0, 0],
    [
      "upgrade(address,address)",
      "lastPeriodsDonations(address)",  //this method is called only to check if the upgrade was made properly
      "setToken(address,uint256,uint8,uint256,uint256,uint256,bytes,bytes)"
    ],
    [
      ["address", "address"],
      ["address"],
      ["address", "uint256", "uint8", "uint256", "uint256", "uint256", "bytes", "bytes"]
    ],
    [
      [donationMinerProxyAddress, newDonationMinerImplementationAddress],
      ["0xa34737409091eBD0726A3Ab5863Fc7Ee9243Edab"],
      [cUSDAddress, toEther(1), 1, toEther(80), toEther(100), uniswapNFTPositionManagerId, "0x", getExchangePathProd(cUSDAddress, PACTAddress)]
    ],
    'Upgrade DonationMiner and update cUSD token'
  );
}

export default func;
func.tags = ["DonationMiner.upgrade+Treasury.setToken"];
