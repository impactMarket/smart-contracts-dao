
# IMCC == Impact Markets Community Contract
import json
import os
import logging


from contract import Contract
from events_helpers import initConnection, get_event_logs, get_community_event_logs, extract_community_doners, \
    extract_token_holders, extract_transfers_and_save_to_file
from util import from_base_18, get_start_block, get_block_steps, ENV_WEB3_NETWORK
from web3_instance import get_web3

STEP_SIZE = 100000
# STEP_SIZE = 20000

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
    _start_name = token_name + '.transfers.'
    prefix_length = len(_start_name)
    existing_names = [n[prefix_length:] for n in os.listdir(save_path) if n.startswith(_start_name)]
    _starting_names = []
    saved_files = []
    args_lists = []
    network = os.getenv(ENV_WEB3_NETWORK)

    if existing_names:
        _names = [os.path.splitext(n)[0] if n.endswith('.json') else n for n in existing_names]
        _starting_ranges = sorted([int(n.split('-')[0]) for n in _names])
        _ending_ranges = sorted([int(n.split('-')[1]) for n in _names])
        valid_ranges_i = [i for i, block in enumerate(_ending_ranges) if block <= to_block]

        if valid_ranges_i:
            _starting_ranges = _starting_ranges[:max(valid_ranges_i)]
            _ending_ranges = _ending_ranges[:max(valid_ranges_i)]

            first_block = _starting_ranges[0]
            last_end_block = _ending_ranges[0]
            missing_ranges = []
            if from_block < first_block:
                missing_ranges.append((from_block, first_block-1))
                _starting_names.append(os.path.join(save_path, '%s.transfers.%s-%s.json' % (token_name, from_block, first_block - 1)))

            _starting_names.append(os.path.join(save_path, '%s.transfers.%s-%s.json' % (token_name, first_block, last_end_block)))
            for i, start_block in enumerate(_starting_ranges[1:]):
                d = start_block - last_end_block
                if d > 1:
                    missing_ranges.append((last_end_block + 1, start_block - 1))
                    _starting_names.append(os.path.join(save_path, '%s.transfers.%s-%s.json' % (token_name, last_end_block + 1, start_block - 1)))
                last_end_block = _ending_ranges[i+1]
                _starting_names.append(os.path.join(save_path, '%s.transfers.%s-%s.json' % (token_name, start_block, last_end_block)))

            last_block = last_end_block
            if last_block > from_block:
                from_block = last_block + 1

        args_lists = []
        saved_files = _starting_names
        for _block_range in missing_ranges:
            _from, _last = _block_range
            name = os.path.join(save_path, '%s.transfers.%s-%s.json' % (token_name, _from, _last))
            if os.path.exists(name):
                print('transfers already completed for range: %s - %s, file %s' % (_from, _last, name))
                # saved_files.append(name)
                continue

            print('getting transfers between blocks: %s, %s' % (_from, _last))
            print('saving transfers to file: %s' % name)
            # saved_files.append(name)
            args_lists.append([network, name, token_address, token_name, _from, _last, None, chunk_size])

    if from_block <= to_block:
        _r = get_block_steps(from_block, to_block, STEP_SIZE)
        _last = _r[0] - 1
        for i in range(len(_r)-1):
            _from = _last + 1
            _last = _r[i+1]
            name = os.path.join(save_path, '%s.transfers.%s-%s.json' % (token_name, _from, _last))
            if os.path.exists(name):
                print('transfers already completed for range: %s - %s, file %s' % (_from, _last, name))
                saved_files.append(name)
                continue

            print('getting transfers between blocks: %s, %s' % (_from, _last))
            print('saving transfers to file: %s' % name)

            saved_files.append(name)
            args_lists.append([network, name, token_address, token_name, _from, _last, None, chunk_size])

    if args_lists:
        process_pool.map(extract_transfers_and_save_to_file, args_lists)

    all_transfers = []
    for name in saved_files:
        with open(name) as f:
            transfers = json.load(f)
            all_transfers.extend(transfers)
    if all_transfers[-1][3] > to_block:
        all_transfers = [t for t in all_transfers if t[3] <= to_block]
    return all_transfers


def process_cUSD_token(process_pool, save_path, start_block, target_block, cusd_address, communities):
    cusd_transfers = dispatch_get_all_transfers(process_pool, save_path, start_block, target_block, cusd_address, 'cUSD')
    cusd_doners_list = extract_community_doners(cusd_transfers, communities)
    cusd_holders = extract_token_holders(cusd_transfers, min_amount=10.0)
    return cusd_transfers, cusd_doners_list, cusd_holders


def process_celo_token(process_pool, save_path, start_block, target_block, celo_address, communities):
    celo_transfers = dispatch_get_all_transfers(process_pool, save_path, start_block, target_block, celo_address, 'CELO')
    celo_doners_list = extract_community_doners(celo_transfers, communities)
    celo_holders = extract_token_holders(celo_transfers, min_amount=1.0)
    return celo_transfers, celo_doners_list, celo_holders


def process_ube_token(process_pool, save_path, start_block, target_block, ube_address):
    ube_transfers = dispatch_get_all_transfers(process_pool, save_path, start_block, target_block, ube_address, 'UBE')
    ube_holders = extract_token_holders(ube_transfers)
    return ube_transfers, ube_holders


def process_moo_token(process_pool, save_path, start_block, target_block, moo_address):
    moo_transfers = dispatch_get_all_transfers(process_pool, save_path, start_block, target_block, moo_address, 'MOO')
    moo_holders = extract_token_holders(moo_transfers)
    return moo_transfers, moo_holders


def get_impact_market_managers(process_pool, save_path, communities, from_block, to_block, chunk_size=100000):
    # All managers via the event ManagerAdded(address indexed _account); event
    main_name = os.path.join(save_path, 'managers.%s-%s.json' % (from_block, to_block))
    if os.path.exists(main_name):
        with open(main_name) as f:
            managers = json.load(f)
            return managers

    event_name_ManagerAdded = 'ManagerAdded'
    args_lists = []
    saved_files = []
    network = os.getenv(ENV_WEB3_NETWORK)
    for i, (comm, block) in enumerate(communities):
        _from = max(from_block, block)
        name = os.path.join(save_path, 'comm-managers.%s.%s-%s.json' % (comm, _from, to_block))
        saved_files.append(name)
        if os.path.exists(name):
            print('community (%s) managers already processed for %s' % (i, comm))
            continue

        print('saving community managers to file: %s' % name)
        args_lists.append((
            network, i, name, comm, 'Community',
            'COMMUNITY_ABI', event_name_ManagerAdded, ['_account'], _from,
            to_block, chunk_size, False
        ))

    process_pool.map(get_event_logs, args_lists)
    managers = []
    for name in saved_files:
        with open(name) as f:
            manager_list = json.load(f)
            managers.extend(manager_list)

    with open(main_name, 'w') as f:
        json.dump(managers, f)

    return managers


def get_impact_market_beneficiaries0(process_pool, save_path, communities, from_block, to_block, chunk_size=100000):
    # All beneficiaries via the event BeneficiaryClaim(address indexed _account, uint256 _amount);  event
    main_name = os.path.join(save_path, 'beneficiary_claims.%s-%s.json' % (from_block, to_block))
    if os.path.exists(main_name):
        with open(main_name) as f:
            beneficiary_claims = json.load(f)
            return beneficiary_claims

    event_name_BeneficiaryClaim = 'BeneficiaryClaim'
    args_lists = []
    saved_files = []
    network = os.getenv(ENV_WEB3_NETWORK)
    for i, (comm, block) in enumerate(communities):
        _from = max(from_block, block)
        name = os.path.join(save_path, 'comm.%s.%s-%s.json' % (comm, _from, to_block))
        saved_files.append(name)
        if os.path.exists(name):
            print('community (%s) beneficiaries already processed for %s' % (i, comm))
            continue

        print('saving beneficiaries to file: %s' % name)
        args_lists.append((
            network, i, name, comm, 'Community',
            'COMMUNITY_ABI', event_name_BeneficiaryClaim, ['_account', '_amount'], _from,
            to_block, chunk_size, False
        ))

    process_pool.map(get_event_logs, args_lists)

    beneficiary_claims = []
    for name in saved_files:
        with open(name) as f:
            address_claim_list = json.load(f)
            beneficiary_claims.extend([(a, from_base_18(value)) for a, value, _block in address_claim_list])

    with open(main_name, 'w') as f:
        json.dump(beneficiary_claims, f)

    return beneficiary_claims

def get_impact_market_beneficiaries(process_pool, save_path, communities, from_block, to_block, chunk_size=100000):
    # All beneficiaries via the event BeneficiaryAdded(address indexed _account);  event
    main_name = os.path.join(save_path, 'beneficiary_added.%s-%s.json' % (from_block, to_block))
    if os.path.exists(main_name):
        with open(main_name) as f:
            beneficiary_added = json.load(f)
            return beneficiary_added

    event_name_BeneficiaryAdded = 'BeneficiaryAdded'
    args_lists = []
    saved_files = []
    network = os.getenv(ENV_WEB3_NETWORK)
    for i, (comm, block) in enumerate(communities):
        _from = max(from_block, block)
        name = os.path.join(save_path, 'comm.%s.%s-%s.json' % (comm, _from, to_block))
        saved_files.append(name)
        if os.path.exists(name):
            print('community (%s) beneficiaries already processed for %s' % (i, comm))
            continue

        print('saving beneficiaries to file: %s' % name)
        args_lists.append((
            network, i, name, comm, 'Community',
            'COMMUNITY_ABI', event_name_BeneficiaryAdded, ['_account'], _from,
            to_block, chunk_size, False
        ))

    process_pool.map(get_event_logs, args_lists)

    beneficiary_added = []
    for name in saved_files:
        with open(name) as f:
            address_added_list = json.load(f)
            beneficiary_added.extend([(a) for a, _block in address_added_list])

    with open(main_name, 'w') as f:
        json.dump(beneficiary_added, f)

    return beneficiary_added


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
    network = os.getenv(ENV_WEB3_NETWORK)
    for i, (pair_address, block) in enumerate(pair_contracts):
        name = os.path.join(save_path, 'ubeswap.pair%s.swaps.json' % i)
        saved_files.append(name)
        if os.path.exists(name):
            print('pair (%s) swaps already processed.' % (i,))
            continue

        # args_lists.append((i, name, pair_address, block, blockNumber, chunk_size))
        args_lists.append((
            network, i, name, pair_address, pair_name,
            'UBE_PAIR_ABI', event_name_Swap, [arg_name], block,
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
    network = os.getenv(ENV_WEB3_NETWORK)
    for e in events_names:
        name = os.path.join(save_path, 'moola.%s.json' % e)
        saved_files.append(name)
        if os.path.exists(name):
            print('event (%s) logs already processed.' % (e,))
            continue

        args_lists.append((
            network, '0', name, moola_lending_pool, lendingpool_name,
            'MOOLA_LENDINGPOOL_ABI', e, [arg_name], lending_start_block,
            blockNumber, chunk_size, True
        ))

    process_pool.map(get_event_logs, args_lists)
    users = []
    for name in saved_files:
        with open(name) as f:
            users.extend(json.load(f))

    return users
