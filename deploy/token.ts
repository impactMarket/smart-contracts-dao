
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  await deploy('IPCTToken', {
    from: deployer,
    args: [deployer],
    log: true,
    gasLimit: 13000000,
  });
};

export default func;
func.tags = ['Token'];