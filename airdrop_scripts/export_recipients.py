
# IMCC == Impact Markets Community Contract
import csv
import os

from web3 import Web3

from airdrop_scripts.custom_web3.contract import Contract
from airdrop_scripts.util import get_web3_network, get_web3_connection_provider, from_base_18
from airdrop_scripts.web3_instance import set_web3, get_web3

impactMarketContract = 'ImpactMarket'
address_impactMarketContract = '0xe55C3eb4a04F93c3302A5d8058348157561BF5ca'
imcEvents = ['CommunityAdded', 'CommunityRemoved', 'CommunityMigrated', 'CommunityFactoryChanged']

communityFactoryContract = 'CommunityFactory'
address_communityFactoryContract = '0xF3ba2c917b01627fb90673Aae0E170EE767Af8b6'
cfcEvents = []

communityContract = 'Community'
ccEvents = []


def _get_community_event_logs(
        event_name, community_address, web3, abi_path,
        from_block, to_block, filters, chunk_size=100000):
    comm_contract = Contract('Community', abi_path, web3.toChecksumAddress(community_address))
    logs = comm_contract.get_event_logs(
        event_name, from_block, to_block,
        filters,
        web3,
        chunk_size=chunk_size
    )
    return logs


def getIMCCManagers(communities, from_block, to_block):
    # All managers via the event ManagerAdded(address indexed _account); event
    filters = {}
    web3 = get_web3()
    abi_path = os.getenv('COMMUNITY_ABI')
    event_name_ManagerAdded = 'ManagerAdded'
    managers = []
    for comm in communities:
        logs = _get_community_event_logs(
            event_name_ManagerAdded, comm, web3, abi_path, from_block, to_block, filters)
        managers.extend([l.args["_account"] for l in logs])

    return managers


def getIMCCBeneficiaries(communities, from_block, to_block):
    # All beneficiaries via the event BeneficiaryClaim(address indexed _account, uint256 _amount);  event
    filters = {}
    web3 = get_web3()
    abi_path = os.getenv('COMMUNITY_ABI')
    event_name_ManagerAdded = 'BeneficiaryClaim'
    beneficiary_claims = []
    for comm in communities:
        logs = _get_community_event_logs(
            event_name_ManagerAdded, comm, web3, abi_path, from_block, to_block, filters)
        beneficiary_claims.extend([(l.args["_account"], from_base_18(l.args["_amount"])) for l in logs])

    return beneficiary_claims


def getUbeswapUsers(blockNumber: int):
    address = '0x00Be915B9dCf56a3CBE739D9B9c202ca692409EC'
    start_block = 6233862
    return []


def getMoolaUsers(blockNumber: int):
    address = '0x17700282592D6917F6A73D0bF8AcCf4D578c131e'
    start_block = 7865765
    return []


def initConnection():
    # Web3Provider.init_web3(provider=get_web3_connection_provider(config.network_url))
    # ContractHandler.set_artifacts_path(config.artifacts_path)

    try:
        web3 = get_web3()
        return web3
    except AssertionError:
        pass

    network = get_web3_network()
    provider = get_web3_connection_provider(network)
    set_web3(Web3(provider))
    return get_web3()
