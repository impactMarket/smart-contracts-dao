import os
import json

import airdrop_scripts.util as util
import airdrop_scripts.export_recipients as exr
from airdrop_scripts.export_recipients import initConnection
from airdrop_scripts.util import get_start_block, to_base_18, from_base_18
from  airdrop_scripts.web3_instance import get_web3
from airdrop_scripts.custom_web3.contract import Contract


def set_envvars():
    # os.environ['WEB3_NETWORK'] = "https://celo-mainnet--rpc.datahub.figment.io/apikey/25daa59318b13c1f83a8a444578fdb57"
    os.environ['WEB3_NETWORK'] = "http://localhost:8545"
    # os.getcwd()
    # '/home/ssallam/pycharm_projects/impact-market-token'
    os.environ["IMARKET_ABI"]="./airdrop_scripts/abi/ImpactMarket.json"
    os.environ["CFACTORY_ABI"] = "./airdrop_scripts/abi/CommunityFactory.json"
    os.environ["COMMUNITY_ABI"] = "./airdrop_scripts/abi/Community.json"
    os.environ["ERC20_ABI"] = "./airdrop_scripts/abi/ERC20.json"


def get_ubeswap_info():
    ube_token = '0x00Be915B9dCf56a3CBE739D9B9c202ca692409EC'
    ubeswap_factory = '0x62d5b84bE28a183aBB507E125B384122D2C25fAE'
    ube_swap_router = '0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121'
    start_block = 6233862
    factory_start_block = 5272596
    return ube_token, start_block, ubeswap_factory, ube_swap_router, factory_start_block


def get_moola_info():
    address = '0x17700282592D6917F6A73D0bF8AcCf4D578c131e'
    moolaswap_factory = ''
    start_block = 7865765
    lending_pool = '0xc1548F5AA1D76CDcAB7385FA6B5cEA70f941e535'
    lp_block = 3419590
    factory_start_block = ''
    return address, start_block, moolaswap_factory, factory_start_block


def get_impact_market_info():
    exr.initConnection()

    imarket = Contract('ImpactMarket', os.getenv('IMARKET_ABI'), '0xe55C3eb4a04F93c3302A5d8058348157561BF5ca')
    comm_factory = Contract('CommunityFactory', os.getenv('CFACTORY_ABI'), '0xF3ba2c917b01627fb90673Aae0E170EE767Af8b6')
    assert comm_factory.contract_concise.impactMarketAddress() == imarket.contract.address
    cusd_address = comm_factory.contract_concise.cUSDAddress()
    celo_address = '0x471ece3750da237f93b8e339c536989b8978a438'

    from_block = get_start_block()
    if not from_block:
        from_block = 2627648
    return imarket.address, comm_factory.address, cusd_address, celo_address, from_block


def get_imarket_communities(_web3, imarket_address, _from, _to):
    # imarket_address = '0xe55C3eb4a04F93c3302A5d8058348157561BF5ca'
    imarket = Contract('ImpactMarket', os.getenv('IMARKET_ABI'), imarket_address)
    event_name_CommunityAdded = 'CommunityAdded'
    logs = imarket.get_event_logs(event_name_CommunityAdded, _from, _to, {}, _web3, chunk_size=500000)
    return [(l.args._communityAddress, l.blockNumber) for l in logs]


def get_all_transfers(_web3, token_address, token_name, _from, _to, filters=None, chunk_size=1000):
    filters = filters if filters is not None else {}
    erc20 = Contract(token_name, os.getenv('ERC20_ABI'), _web3.toChecksumAddress(token_address))
    event_name_Transfer = 'Transfer'
    logs = erc20.get_event_logs(
        event_name_Transfer, _from, _to,
        filters,
        _web3,
        chunk_size=chunk_size
    )
    return [(l.args["from"], l.args.to, l.args.value, l.blockNumber) for l in logs]


def extract_transfers_and_save_to_file(
        filename, token_address, token_name, _from, _to, filters=None, chunk_size=1000):

    web3 = initConnection()
    transfers = get_all_transfers(web3, token_address, token_name, _from, _to, filters, chunk_size)
    with open(filename, 'w') as outfile:
        json.dump(transfers, outfile)

    return transfers


def get_community_transfers(_web3, token_address, token_name, _from, _to, filters=None, chunk_size=500000, sender='doner'):
    erc20 = Contract(token_name, os.getenv('ERC20_ABI'), _web3.toChecksumAddress(token_address))
    event_name_Transfer = 'Transfer'
    logs = erc20.get_event_logs(
        event_name_Transfer, _from, _to,
        filters or {},
        _web3,
        chunk_size=chunk_size
    )
    if sender == 'doner':
        return [(l.args['from'], l.args.value) for l in logs]
    elif sender == 'community':
        return [(l.args.to, l.args.value) for l in logs]

    return [(l.args['from'], l.args.to, l.args.value) for l in logs]


def process_files(numbers, path=None):
    if path is None:
        path = '/home/ssallam/CELO_transfers_dir'
    _fn = os.path.join(path, 'CELO_transfers%s.txt')
    all_transfers = []
    total_count = 0
    for n in numbers:
        fn = _fn % n
        with open(fn) as f:
            c = f.read()
            c_q = c.replace("'", '"')
            c_q = c_q.replace("(", '[')
            c_q = c_q.replace(")", ']')
            transfers_list = json.loads(c_q)
            print('num transfers in file (%s): %s' % (n, len(transfers_list)))
            all_transfers.extend(transfers_list)
            total_count += len(transfers_list)

    outfname = '/home/ssallam/CELO_transfers_dir/transfers.json'
    with open(outfname, 'w') as outf:
        json.dump(all_transfers, outf)

    # print('num all transfers: %s' % len(transfers_list))
    assert len(all_transfers) == total_count, 'count mismatch: len(all)=%s, count=%s' % (len(all_transfers), total_count)
    return all_transfers


def extract_community_doners(transfers, communities):
    doner_value_list = []
    comms_set = set(communities)
    for _from, _to, value, block in transfers:
        if _to in comms_set:
            doner_value_list.append((_from, util.from_base_18(value)))

    return doner_value_list


def extract_token_holders(transfers, min_amount=1.0):
    balances = calculate_balances(transfers)
    _min_amount = to_base_18(min_amount)
    balances = {a: from_base_18(value) for a, value in balances.items() if value >= _min_amount}
    return balances


def calculate_balances(transfers):
    _from = [t[0].lower() for t in transfers]
    _to = [t[1].lower() for t in transfers]
    _value = [t[2] for t in transfers]

    a_to_value = {a: 0 for a in _from}
    a_to_value.update({a: 0 for a in _to})

    for i, acc_f in enumerate(_from):
        a_to_value[acc_f] -= int(_value[i])
        a_to_value[_to[i]] += int(_value[i])

    return a_to_value

