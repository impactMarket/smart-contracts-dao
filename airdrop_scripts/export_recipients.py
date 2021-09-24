
# IMCC == Impact Markets Community Contract
import json
import os

from airdrop_scripts.custom_web3.contract import Contract
from airdrop_scripts.events_helpers import initConnection, get_event_logs, get_community_event_logs, extract_community_doners, \
    extract_token_holders, extract_transfers_and_save_to_file
from airdrop_scripts.util import from_base_18, get_start_block, get_block_steps
from airdrop_scripts.web3_instance import get_web3

STEP_SIZE = 50000

impactMarketContract = 'ImpactMarket'
address_impactMarketContract = '0xe55C3eb4a04F93c3302A5d8058348157561BF5ca'
imcEvents = ['CommunityAdded', 'CommunityRemoved', 'CommunityMigrated', 'CommunityFactoryChanged']

communityFactoryContract = 'CommunityFactory'
address_communityFactoryContract = '0xF3ba2c917b01627fb90673Aae0E170EE767Af8b6'
cfcEvents = []

communityContract = 'Community'
ccEvents = []


def get_impact_market_info():
    initConnection()

    imarket = Contract('ImpactMarket', os.getenv('IMARKET_ABI'), '0xe55C3eb4a04F93c3302A5d8058348157561BF5ca')
    comm_factory = Contract('CommunityFactory', os.getenv('CFACTORY_ABI'), '0xF3ba2c917b01627fb90673Aae0E170EE767Af8b6')
    assert comm_factory.contract_concise.impactMarketAddress() == imarket.contract.address
    cusd_address = comm_factory.contract_concise.cUSDAddress()
    celo_address = '0x471ece3750da237f93b8e339c536989b8978a438'

    from_block = get_start_block()
    if not from_block:
        from_block = 2627648
    return imarket.address, comm_factory.address, cusd_address, celo_address, from_block


def get_ubeswap_info():
    ube_token_address = '0x00Be915B9dCf56a3CBE739D9B9c202ca692409EC'
    start_block = 6233862
    ubeswap_factory_address = '0x62d5b84bE28a183aBB507E125B384122D2C25fAE'
    factory_start_block = 5272596
    ube_swap_router = '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121'
    return ube_token_address, start_block, ubeswap_factory_address, ube_swap_router, factory_start_block


def get_moola_info():
    moo_token_address = '0x17700282592D6917F6A73D0bF8AcCf4D578c131e'
    start_block = 7865765
    # lending_pool_address = '0xF1c906cd0f5519D32BEC7b37C1EB7bD9F5c382c3'
    lending_pool_proxy = '0xc1548F5AA1D76CDcAB7385FA6B5cEA70f941e535'
    lending_pool_block = 3419589
    return moo_token_address, start_block, lending_pool_proxy, lending_pool_block


def dispatch_get_all_transfers(process_pool, save_path, from_block, to_block, token_address, token_name, chunk_size=500):
    names = [n for n in os.listdir(save_path) if n.startswith(token_name)]
    if names:
        _names = [os.path.splitext(n)[0] if n.endswith('.json') else n for n in names]
        last_block = sorted([int(n.split('-')[1]) for n in _names])[-1]
        if last_block > from_block:
            from_block = last_block + 1

    _r = get_block_steps(from_block, to_block, STEP_SIZE)
    _last = _r[0] - 1
    args_lists = []
    saved_files = []
    if names:
        saved_files = [
            os.path.join(save_path, n) for n in names
        ]

    for i in range(len(_r)-1):
        _from = _last + 1
        _last = _r[i+1]
        name = os.path.join(save_path, '%s.transfers.%s-%s.json' % (token_name, _from, _last))
        print('getting transfers between blocks: %s, %s' % (_from, _last))
        print('saving transfers to file: %s' % name)
        saved_files.append(name)
        args_lists.append([name, token_address, token_name, _from, _last, None, chunk_size])

    process_pool.map(extract_transfers_and_save_to_file, args_lists)

    all_transfers = []
    for name in saved_files:
        with open(name) as f:
            transfers = json.load(f)
            all_transfers.extend(transfers)

    return all_transfers


def process_cUSD_token(process_pool, save_path, start_block, target_block, cusd_address, communities):
    cusd_transfers = dispatch_get_all_transfers(process_pool, save_path, start_block, target_block, cusd_address, 'cUSD')
    cusd_doners_list = extract_community_doners(cusd_transfers, communities)
    return cusd_transfers, cusd_doners_list


def process_celo_token(process_pool, save_path, start_block, target_block, celo_address, communities):
    celo_transfers = dispatch_get_all_transfers(process_pool, save_path, start_block, target_block, celo_address, 'CELO')
    celo_doners_list = extract_community_doners(celo_transfers, communities)
    celo_holders = extract_token_holders(celo_transfers)
    return celo_transfers, celo_doners_list, celo_holders


def process_ube_token(process_pool, save_path, start_block, target_block, ube_address):
    ube_transfers = dispatch_get_all_transfers(process_pool, save_path, start_block, target_block, ube_address, 'UBE')
    ube_holders = extract_token_holders(ube_transfers)
    return ube_transfers, ube_holders


def process_moo_token(process_pool, save_path, start_block, target_block, moo_address):
    moo_transfers = dispatch_get_all_transfers(process_pool, save_path, start_block, target_block, moo_address, 'MOO')
    moo_holders = extract_token_holders(moo_transfers)
    return moo_transfers, moo_holders


def get_impact_market_managers(communities, from_block, to_block):
    # All managers via the event ManagerAdded(address indexed _account); event
    filters = {}
    web3 = get_web3()
    abi_path = os.getenv('COMMUNITY_ABI')
    event_name_ManagerAdded = 'ManagerAdded'
    managers = []
    for comm, block in communities:
        logs = get_community_event_logs(
            event_name_ManagerAdded, comm, web3, abi_path, max(from_block, block), to_block, filters, chunk_size=100000)
        managers.extend([l.args["_account"] for l in logs])

    return managers


def get_impact_market_beneficiaries(communities, from_block, to_block):
    # All beneficiaries via the event BeneficiaryClaim(address indexed _account, uint256 _amount);  event
    filters = {}
    web3 = get_web3()
    abi_path = os.getenv('COMMUNITY_ABI')
    event_name_ManagerAdded = 'BeneficiaryClaim'
    beneficiary_claims = []
    for comm, block in communities:
        logs = get_community_event_logs(
            event_name_ManagerAdded, comm, web3, abi_path, max(from_block, block), to_block, filters, chunk_size=100000)
        beneficiary_claims.extend([(l.args["_account"], from_base_18(l.args["_amount"])) for l in logs])

    return beneficiary_claims


def get_ubeswap_users(process_pool, save_path, blockNumber: int, chunk_size=500):
    ube_token, start_block, ubeswap_factory, ube_swap_router, factory_start_block = get_ubeswap_info()
    abi_path = os.getenv('UBE_FACTORY_ABI')
    filters = {}
    web3 = get_web3()

    factory_name = 'Factory'
    event_name_PairCreated = 'PairCreated'
    arg_name = 'pair' # a Pair contract address
    factory_contract = Contract(factory_name, abi_path, web3.toChecksumAddress(ubeswap_factory))
    print('get pair contracts from block %s to block %s' % (factory_start_block, blockNumber))
    logs = factory_contract.get_event_logs(
        event_name_PairCreated,
        factory_start_block,
        blockNumber,
        filters,
        web3,
        chunk_size=100000
    )
    pair_contracts = [(l.args[arg_name], l.blockNumber) for l in logs]
    print('got %s Pair contracts' % len(pair_contracts))

    pair_name = 'Pair'
    event_name_Swap = 'Swap'
    arg_name = 'sender' # a user ethereum address
    args_lists = []
    saved_files = []
    for i, (pair_address, block) in enumerate(pair_contracts):
        name = os.path.join(save_path, 'ubeswap.pair%s.swaps.json' % i)
        saved_files.append(name)
        if os.path.exists(name):
            continue

        # args_lists.append((i, name, pair_address, block, blockNumber, chunk_size))
        args_lists.append((
            i, name, pair_address, pair_name,
            'UBE_PAIR_ABI', event_name_Swap, [arg_name], pair_address,
            blockNumber, chunk_size, False
        ))

    process_pool.map(get_event_logs, args_lists)
    users = []
    for name in saved_files:
        with open(name) as f:
            users.extend(json.load(f))

    return users


def get_moola_users(process_pool, save_path, blockNumber: int, chunk_size=500):
    moo_token, start_block, moola_lending_pool, lending_start_block = get_moola_info()
    lendingpool_name = 'LendingPool'
    events_names = ['Deposit', 'Borrow', 'Swap']
    arg_name = '_user' # a user ethereum address
    saved_files = []
    args_lists = []
    for e in events_names:
        name = os.path.join(save_path, 'moola.%s.json' % e)
        saved_files.append(name)
        if os.path.exists(name):
            continue

        args_lists.append((
            '0', name, moola_lending_pool, lendingpool_name,
            'MOOLA_LENDINGPOOL_ABI', e, [arg_name], lending_start_block,
            blockNumber, chunk_size, True
        ))

    process_pool.map(get_event_logs, args_lists)
    users = []
    for name in saved_files:
        with open(name) as f:
            users.extend(json.load(f))

    return users
