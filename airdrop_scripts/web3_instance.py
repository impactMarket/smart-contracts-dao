
Web3Instance = None
def get_web3():
    assert Web3Instance, 'web3 instance is not initialized.'
    return Web3Instance


def set_web3(web3):
    global Web3Instance
    Web3Instance = web3
