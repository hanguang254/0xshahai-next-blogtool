# Robinhood Chain 集成说明

## 概述
已成功为合约钱包添加 Robinhood Chain 支持，使用与 BSC 相同的合约地址。

## 已完成的功能

### 1. 网络配置
- **Chain ID**: 4663 (0x1237)
- **RPC**: https://rpc.mainnet.chain.robinhood.com
- **区块浏览器**: https://robinhoodchain.blockscout.com
- **原生代币**: ETH
- **合约地址**: 0x344f1c033Ee37860eEe2CA2873320e08c3fc21c9（与 BSC 相同）

### 2. 数据源
#### BSC 网络
- 使用 **Chainbase API** 获取代币余额
- API Key: 已配置

#### Robinhood 网络
- 使用 **Blockscout API** 获取代币余额（免费）
- Endpoint: https://robinhoodchain.blockscout.com/api/v2
- API 文档: https://docs.blockscout.com/robinhood-api

### 3. 前端功能
- ✅ 网络切换器（BSC / Robinhood）
- ✅ 自动刷新代币列表
- ✅ 锁仓功能支持
- ✅ 提取功能支持
- ✅ 自动网络切换提示

## 文件修改

### `/src/pages/api/balance.ts`
- 添加 Blockscout API 支持
- 实现多网络数据源切换
- 统一的余额格式化（支持十六进制和十进制）

### `/src/pages/wallet/index.tsx`
- 添加 Robinhood Chain 配置
- 添加网络选择器 UI
- 改进错误提示

### `/src/pages/wallet/index.module.css`
- 网络选择器样式
- 响应式设计支持

## 使用说明

### 切换网络
1. 在钱包页面顶部点击 "BSC 网络" 或 "Robinhood 网络" 按钮
2. 系统会自动重新获取对应网络的代币数据
3. 进行交易时会自动提示切换到正确的网络

### 锁仓转入
1. 选择要锁仓的代币
2. 输入锁仓金额和解锁时间
3. 系统会检测当前网络并提示切换（如需要）
4. 确认交易

### 提取代币
1. 只能提取已解锁的代币
2. 系统会验证解锁时间
3. 自动检测网络并提示切换

## API 限制和注意事项

### Blockscout API
- **免费使用**
- 可能有 Cloudflare 保护，但浏览器环境下正常工作
- 返回 ERC-20 代币列表和余额
- API 文档: https://docs.blockscout.com/api-reference

### 备用方案
如果 Blockscout API 不可用，可以考虑：
1. **RPC 直接查询**: 使用 eth_call 查询 ERC-20 balanceOf
2. **QuickNode**: https://www.quicknode.com/guides/robinhood
3. **Alchemy**: 支持 Robinhood Chain RPC
4. **Chainstack**: 提供免费测试网和主网访问

## 相关资源
- [Robinhood Chain 文档](https://docs.robinhood.com/chain/connecting/)
- [Blockscout API 文档](https://docs.blockscout.com/robinhood-api)
- [QuickNode Robinhood 指南](https://www.quicknode.com/guides/robinhood/what-is-robinhood-chain)
- [Robinhood Chain RPC 提供商](https://www.quicknode.com/builders-guide/best/top-10-robinhood-chain-rpc-providers)

## 故障排查

### 问题: 无法获取 Robinhood 代币数据
**可能原因**:
1. Blockscout API 临时不可用
2. Cloudflare 保护触发
3. 网络连接问题

**解决方案**:
1. 刷新页面重试
2. 检查浏览器控制台错误日志
3. 考虑切换到备用 API（需要修改代码）

### 问题: 交易失败
**可能原因**:
1. 未切换到正确的网络
2. Gas 费用不足
3. 代币仍在锁定期

**解决方案**:
1. 确认 MetaMask 已连接到正确的网络
2. 确保钱包有足够的 ETH 支付 Gas
3. 检查锁定期是否已过

## 开发测试
```bash
# 启动开发服务器
npm run dev

# 访问钱包页面
http://localhost:3000/wallet
```

## 部署注意事项
- 确保环境变量正确配置
- Vercel/Netlify 等平台需要配置 API 路由
- 考虑添加 CORS 策略（如果需要）
