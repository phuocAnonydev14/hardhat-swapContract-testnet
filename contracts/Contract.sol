// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MultiSwap {
    mapping(address => mapping(address => uint256)) public rates;

    address public admin;

    event Swap(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor() {
        admin = msg.sender;
    }

    event SetRate(address _token1, address _token2, uint _rate);

    function setRate(
        address _fromToken,
        address _toToken,
        uint256 _rate
    ) external onlyAdmin {
        rates[_fromToken][_toToken] = _rate;
        rates[_toToken][_fromToken] = 1e18 / _rate;
        emit SetRate(_fromToken, _toToken, _rate);
    }

    function swap(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external payable {
        require(_amountIn > 0, "Invalid amount");

        uint256 amountOut = calculateAmountOut(_tokenIn, _tokenOut, _amountIn);

        _handleAmountIn(_tokenIn, _amountIn);
        _handleAmountOut(_tokenOut, amountOut);

        emit Swap(msg.sender, _tokenIn, _tokenOut, _amountIn, amountOut);
    }

    function calculateAmountOut(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) public view returns (uint256) {
        return (_amountIn * rates[_tokenIn][_tokenOut]) / 10 ** 18; // convert to wei unit
    }

    function _handleAmountIn(address _tokenIn, uint _amountIn) internal {
        if (_isNativeToken(_tokenIn)) {
            require(
                _amountIn == msg.value,
                "Amount must be equal to msg.value"
            );
            return;
        }
        IERC20(_tokenIn).approve(msg.sender, _amountIn);
        IERC20(_tokenIn).transferFrom(msg.sender, address(this), _amountIn);
    }

    function _handleAmountOut(address _tokenOut, uint _amountOut) internal {
        if (_isNativeToken(_tokenOut)) {
            (bool sent, ) = msg.sender.call{value: _amountOut}("");
            require(sent, "Failed to send Ether");
            return;
        }
        IERC20(_tokenOut).transfer(msg.sender, _amountOut);
    }

    function getRate(
        address _token1,
        address _token2
    ) public view returns (uint256) {
        return rates[_token1][_token2];
    }

    function depositToken(address _tokenIn, uint _amountIn) public payable {
        _handleAmountIn(_tokenIn, _amountIn);
    }

    // Modifier only admin execute function
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    function _isNativeToken(address _address) internal pure returns (bool) {
        return _address == address(0);
    }
}
