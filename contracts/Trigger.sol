// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./Context.sol";
import "./Ownable.sol";

interface IERC20 {
  function name() external view returns (string memory);
  function symbol() external view returns (string memory);
  function decimals() external view returns (uint8);
  function totalSupply() external view returns (uint256);
  function balanceOf(address account) external view returns (uint256);
  function allowance(address owner, address spender) external view returns (uint256);
  
  function transfer(address recipient, uint256 amount) external returns (bool);
  function approve(address spender, uint256 amount) external returns (bool);
  function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
  
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface IWBNB {
  function withdraw(uint) external;
  function deposit() external payable;
  function transfer(address to, uint value) external returns (bool);
}

interface IPancakeFactory {
  event PairCreated(address indexed token0, address indexed token1, address pair, uint);

  function feeTo() external view returns (address);
  function feeToSetter() external view returns (address);

  function getPair(address tokenA, address tokenB) external view returns (address pair);
  function allPairs(uint) external view returns (address pair);
  function allPairsLength() external view returns (uint);

  function createPair(address tokenA, address tokenB) external returns (address pair);

  function setFeeTo(address) external;
  function setFeeToSetter(address) external;
}

interface IPancakePair {
  event Approval(address indexed owner, address indexed spender, uint value);
  event Transfer(address indexed from, address indexed to, uint value);

  function name() external pure returns (string memory);
  function symbol() external pure returns (string memory);
  function decimals() external pure returns (uint8);
  function totalSupply() external view returns (uint);
  function balanceOf(address owner) external view returns (uint);
  function allowance(address owner, address spender) external view returns (uint);

  function approve(address spender, uint value) external returns (bool);
  function transfer(address to, uint value) external returns (bool);
  function transferFrom(address from, address to, uint value) external returns (bool);

  function DOMAIN_SEPARATOR() external view returns (bytes32);
  function PERMIT_TYPEHASH() external pure returns (bytes32);
  function nonces(address owner) external view returns (uint);

  function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;

  event Mint(address indexed sender, uint amount0, uint amount1);
  event Burn(address indexed sender, uint amount0, uint amount1, address indexed to);
  event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to);
  event Sync(uint112 reserve0, uint112 reserve1);

  function MINIMUM_LIQUIDITY() external pure returns (uint);
  function factory() external view returns (address);
  function token0() external view returns (address);
  function token1() external view returns (address);
  function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
  function price0CumulativeLast() external view returns (uint);
  function price1CumulativeLast() external view returns (uint);
  function kLast() external view returns (uint);

  function mint(address to) external returns (uint liquidity);
  function burn(address to) external returns (uint amount0, uint amount1);
  function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
  function skim(address to) external;
  function sync() external;

  function initialize(address, address) external;
}

library TransferHelper {
  function safeApprove(address token, address to, uint value) internal {
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x095ea7b3, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: APPROVE_FAILED');
  }

  function safeTransfer(address token, address to, uint value) internal {
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0xa9059cbb, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FAILED');
  }

  function safeTransferFrom(address token, address from, address to, uint value) internal {
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'TransferHelper: TRANSFER_FROM_FAILED');
  }

  function safeTransferETH(address to, uint value) internal {
    (bool success,) = to.call{value:value}(new bytes(0));
    require(success, 'TransferHelper: ETH_TRANSFER_FAILED');
  }
}

library SafeMath {
  function add(uint x, uint y) internal pure returns (uint z) {
    require((z = x + y) >= x, 'ds-math-add-overflow');
  }

  function sub(uint x, uint y) internal pure returns (uint z) {
    require((z = x - y) <= x, 'ds-math-sub-underflow');
  }

  function mul(uint x, uint y) internal pure returns (uint z) {
    require(y == 0 || (z = x * y) / y == x, 'ds-math-mul-overflow');
  }
}

library PancakeLibrary {
  using SafeMath for uint;

  function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
    require(tokenA != tokenB, 'PancakeLibrary: IDENTICAL_ADDRESSES');
    (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    require(token0 != address(0), 'PancakeLibrary: ZERO_ADDRESS');
  }

  function pairFor(address factory, address tokenA, address tokenB) internal pure returns (address pair) {
    (address token0, address token1) = sortTokens(tokenA, tokenB);
    pair = address(bytes20(keccak256(abi.encodePacked(
      hex'ff',
      factory,
      keccak256(abi.encodePacked(token0, token1)),
      hex'00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5' // init code hash
    ))));
  }

  function getReserves(address factory, address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB) {
    (address token0,) = sortTokens(tokenA, tokenB);
    pairFor(factory, tokenA, tokenB);
    (uint reserve0, uint reserve1,) = IPancakePair(pairFor(factory, tokenA, tokenB)).getReserves();
    (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
  }

  function quote(uint amountA, uint reserveA, uint reserveB) internal pure returns (uint amountB) {
    require(amountA > 0, 'PancakeLibrary: INSUFFICIENT_AMOUNT');
    require(reserveA > 0 && reserveB > 0, 'PancakeLibrary: INSUFFICIENT_LIQUIDITY');
    amountB = amountA.mul(reserveB) / reserveA;
  }

  function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
    require(amountIn > 0, 'PancakeLibrary: INSUFFICIENT_INPUT_AMOUNT');
    require(reserveIn > 0 && reserveOut > 0, 'PancakeLibrary: INSUFFICIENT_LIQUIDITY');
    uint amountInWithFee = amountIn.mul(9975);
    uint numerator = amountInWithFee.mul(reserveOut);
    uint denominator = reserveIn.mul(10000).add(amountInWithFee);
    amountOut = numerator / denominator;
  }

  function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) internal pure returns (uint amountIn) {
    require(amountOut > 0, 'PancakeLibrary: INSUFFICIENT_OUTPUT_AMOUNT');
    require(reserveIn > 0 && reserveOut > 0, 'PancakeLibrary: INSUFFICIENT_LIQUIDITY');
    uint numerator = reserveIn.mul(amountOut).mul(10000);
    uint denominator = reserveOut.sub(amountOut).mul(9975);
    amountIn = (numerator / denominator).add(1);
  }

  function getAmountsOut(address factory, uint amountIn, address[] memory path) internal view returns (uint[] memory amounts) {
    require(path.length >= 2, 'PancakeLibrary: INVALID_PATH');
    amounts = new uint[](path.length);
    amounts[0] = amountIn;
    for (uint i; i < path.length - 1; i++) {
      (uint reserveIn, uint reserveOut) = getReserves(factory, path[i], path[i + 1]);
      amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
    }
  }

  function getAmountsIn(address factory, uint amountOut, address[] memory path) internal view returns (uint[] memory amounts) {
    require(path.length >= 2, 'PancakeLibrary: INVALID_PATH');
    amounts = new uint[](path.length);
    amounts[amounts.length - 1] = amountOut;
    for (uint i = path.length - 1; i > 0; i--) {
      (uint reserveIn, uint reserveOut) = getReserves(factory, path[i - 1], path[i]);
      amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
    }
  }
}

contract Trigger is Ownable {
  using SafeMath for uint;

  // bsc variables 
  address constant wbnb= 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
  address constant cakeFactory = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;

  address payable private administrator;
  uint private wbnbIn;
  uint private minTknOut;
  address private tokenToBuy;
  address private tokenPaired;
  bool private snipeLock;

  modifier ensure(uint deadline) {
    require(deadline >= block.timestamp, 'PancakeRouter: EXPIRED');
    _;
  }

  mapping(address => bool) public authenticatedSeller;

  constructor(){
    administrator = payable(msg.sender);
    authenticatedSeller[msg.sender] = true;
  }

  receive() external payable {
    IWBNB(wbnb).deposit{value: msg.value}();
  }

  function _dwich(uint[] memory amounts, address[] memory path, address _to) internal virtual {
    for (uint i; i < path.length - 1; i++) {
      (address input, address output) = (path[i], path[i + 1]);
      (address token0,) = PancakeLibrary.sortTokens(input, output);
      uint amountOut = amounts[i + 1];
      (uint amount0Out, uint amount1Out) = input == token0 ? (uint(0), amountOut) : (amountOut, uint(0));
      address to = i < path.length - 2 ? PancakeLibrary.pairFor(cakeFactory, output, path[i + 2]) : _to;
      IPancakePair(PancakeLibrary.pairFor(cakeFactory, input, output)).swap(
          amount0Out, amount1Out, to, new bytes(0)
      );
    }
  }

  function sandwichExactTokensForTokens(
    uint amountIn,
    uint amountOutMin,
    address[] memory path,
    address to,
    uint deadline
  ) internal virtual ensure(deadline) returns (uint[] memory amounts) {
    amounts = PancakeLibrary.getAmountsOut(cakeFactory, amountIn, path);
    require(amounts[amounts.length - 1] >= amountOutMin, 'PancakeRouter: INSUFFICIENT_OUTPUT_AMOUNT');
    TransferHelper.safeTransferFrom(
        path[0], msg.sender, PancakeLibrary.pairFor(cakeFactory, path[0], path[1]), amounts[0]
    );
    _dwich(amounts, path, to);
  }

  function sandwichTokensForExactTokens(
    uint amountOut,
    uint amountInMax,
    address[] memory path,
    address to,
    uint deadline
  ) internal virtual ensure(deadline) returns (uint[] memory amounts) {
    amounts = PancakeLibrary.getAmountsIn(cakeFactory, amountOut, path);
    require(amounts[0] <= amountInMax, 'PancakeRouter: EXCESSIVE_INPUT_AMOUNT');
    TransferHelper.safeTransferFrom(
        path[0], msg.sender, PancakeLibrary.pairFor(cakeFactory, path[0], path[1]), amounts[0]
    );
    _dwich(amounts, path, to);
  }

  function snipeListing() external returns(bool success){
    require(IERC20(wbnb).balanceOf(address(this)) >= wbnbIn, "snipe: not enough wbnb on the contract");
    IERC20(wbnb).approve(address(this), wbnbIn);
    require(snipeLock == false, "snipe: sniping is locked. See configure");
    snipeLock = true;
    
    address[] memory path;
    if (tokenPaired != wbnb){
      path = new address[](3);
      path[0] = wbnb;
      path[1] = tokenPaired;
      path[2] = tokenToBuy;
    } else {
      path = new address[](2);
      path[0] = wbnb;
      path[1] = tokenToBuy;
    }

    sandwichExactTokensForTokens(
        wbnbIn,
        minTknOut,
        path, 
        administrator,
        block.timestamp + 120
    );
    return true;
  }

  function sandwichIn(address tokenOut, uint  amountIn, uint amountOutMin) external returns(bool success) {
    require(msg.sender == administrator || msg.sender == owner(), "in: must be called by admin or owner");
    require(IERC20(wbnb).balanceOf(address(this)) >= amountIn, "in: not enough wbnb on the contract");
    IERC20(wbnb).approve(address(this), amountIn);
    
    address[] memory path;
    path = new address[](2);
    path[0] = wbnb;
    path[1] = tokenOut;
    
    sandwichExactTokensForTokens(
      amountIn,
      amountOutMin,
      path, 
      address(this),
      block.timestamp + 120
    );
    return true;
  }

  function sandwichOut(address tokenIn, uint amountOutMin) external returns(bool success) {
    require(authenticatedSeller[msg.sender] == true, "out: must be called by authenticated seller");
    uint amountIn = IERC20(tokenIn).balanceOf(address(this));
    require(amountIn >= 0, "out: empty balance for this token");
    IERC20(tokenIn).approve(address(this), amountIn);
    
    address[] memory path;
    path = new address[](2);
    path[0] = tokenIn;
    path[1] = wbnb;
    
    sandwichExactTokensForTokens(
      amountIn,
      amountOutMin,
      path, 
      address(this),
      block.timestamp + 120
    );
    
    return true;
  }

  function authenticateSeller(address _seller) external onlyOwner {
    authenticatedSeller[_seller] = true;
  }

  function getAdministrator() external view onlyOwner returns( address payable){
    return administrator;
  }

  function setAdministrator(address payable _newAdmin) external onlyOwner returns(bool success){
    administrator = _newAdmin;
    authenticatedSeller[_newAdmin] = true;
    return true;
  }
  
  function configureSnipe(address _tokenPaired, uint _amountIn, address _tknToBuy,  uint _amountOutMin) external onlyOwner returns(bool success){
    tokenPaired = _tokenPaired;
    wbnbIn = _amountIn;
    tokenToBuy = _tknToBuy;
    minTknOut= _amountOutMin;
    snipeLock = false;
    return true;
  }
  
  function getSnipeConfiguration() external view onlyOwner returns(address, uint, address, uint, bool){
    return (tokenPaired, wbnbIn, tokenToBuy, minTknOut, snipeLock);
  }
  
  function emmergencyWithdrawTkn(address _token, uint _amount) external onlyOwner returns(bool success){
    require(IERC20(_token).balanceOf(address(this)) >= _amount, "not enough tokens in contract");
    IERC20(_token).transfer(administrator, _amount);
    return true;
  }
  
  function emmergencyWithdrawBnb() external onlyOwner returns(bool success){
    require(address(this).balance >0 , "contract has an empty BNB balance");
    administrator.transfer(address(this).balance);
    return true;
  }
}