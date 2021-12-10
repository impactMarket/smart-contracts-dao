import { BigNumber, utils } from 'ethers'
import BalanceTree from './balance-tree'

const { isAddress, getAddress } = utils

// This is the blob that gets distributed and pinned to IPFS.
// It is completely sufficient for recreating the entire merkle tree.
// Anyone can verify that all air drops are included in the tree,
// and the tree has no additional distributions.
interface MerkleDistributorInfo {
  merkleRoot: string
  tokenTotal: string
  claims: {
    [account: string]: {
      index: number
      amount: string
      proof: string[]
      flags?: {
        [flag: string]: boolean
      }
    }
  }
}

type OldFormat = { [account: string]: number | string }
type NewFormat = { address: string; earnings: string; reasons: string }

export function parseBalanceMap(balances: OldFormat | NewFormat[]): MerkleDistributorInfo {
  // if balances are in an old format, process them
  const balancesInNewFormat: NewFormat[] = Array.isArray(balances)
    ? balances
    : Object.keys(balances).map(
        (account): NewFormat => ({
          address: account,
          earnings: `0x${balances[account].toString(16)}`,
          reasons: '',
        })
      )

  const dataByAddress = balancesInNewFormat.reduce<{
    [address: string]: { amount: BigNumber; flags?: { [flag: string]: boolean } }
  }>((memo, { address: account, earnings, reasons }) => {
    if (!isAddress(account)) {
      throw new Error(`Found invalid address: ${account}`)
    }
    const parsed = getAddress(account)
    if (memo[parsed]) throw new Error(`Duplicate address: ${parsed}`)
    const parsedNum = BigNumber.from(earnings)
    if (parsedNum.lte(0)) throw new Error(`Invalid amount for account: ${account}`)

    const flags = {
      isV1: reasons.includes('V1'),
      isV2_DAI: reasons.includes('V2_DAI'),
      isV2_USDC: reasons.includes('V2_USDC'),
      isV2_DAI_PODS: reasons.includes('V2_DAI_PODS'),
      isV2_USDC_PODS: reasons.includes('V2_USDC_PODS'),
      isV3_DAI: reasons.includes('V3_DAI'),
      isV3_UNI: reasons.includes('V3_UNI'),
      isV3_USDC: reasons.includes('V3_USDC'),
      isSnapshot: reasons.includes('snapshot'),
    }

    memo[parsed] = { amount: parsedNum, ...(reasons === '' ? {} : { flags }) }
    return memo
  }, {})

  const sortedAddresses = Object.keys(dataByAddress).sort()

  // construct a tree
  const tree = new BalanceTree(
    sortedAddresses.map((address) => ({ account: address, amount: dataByAddress[address].amount }))
  )

  // generate claims
  const claims = sortedAddresses.reduce<{
    [address: string]: { amount: string; index: number; proof: string[]; flags?: { [flag: string]: boolean } }
  }>((memo, address, index) => {
    const { amount, flags } = dataByAddress[address]
    memo[address] = {
      index,
      amount: amount.toHexString(),
      proof: tree.getProof(index, address, amount),
      ...(flags ? { flags } : {}),
    }
    return memo
  }, {})

  const tokenTotal: BigNumber = sortedAddresses.reduce<BigNumber>(
    (memo, key) => memo.add(dataByAddress[key].amount),
    BigNumber.from(0)
  )

  return {
    merkleRoot: tree.getHexRoot(),
    tokenTotal: tokenTotal.toHexString(),
    claims,
  }
}
