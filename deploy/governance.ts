
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { parseEther } from '@ethersproject/units';
import { BigNumberish } from 'ethers';

const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60; // 2 days
const VOTING_PERIOD_BLOCKS = 17280; // about 1 day
const VOTING_DELAY_BLOCKS = 17280 * 2; // about 2 days 
const PROPOSAL_THRESHOLD : BigNumberish = parseEther("1000000"); // one million units

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  const timelockResult = await deploy('IPCTTimelock', {
    from: deployer,
    args: [deployer, TWO_DAYS_SECONDS],
    log: true,
    gasLimit: 13000000,
  });

  const delegateResult = await deploy('IPCTDelegate', {
    from: deployer,
    log: true,
    gasLimit: 13000000,
  });

  const Token = await deployments.get('IPCTToken');
  const delegatorResult = await deploy('IPCTDelegator', {
    from: deployer,
    args: [
      timelockResult.address, 
      Token.address, 
      Token.address, //"0x0000000000000000000000000000000000000000", 
      deployer,
      delegateResult.address,
      VOTING_PERIOD_BLOCKS,
      VOTING_DELAY_BLOCKS,
      PROPOSAL_THRESHOLD
    ],
    log: true,
    gasLimit: 13000000,
  });
};

func.dependencies = ['Token'];
func.tags = ['Governance'];
export default func;