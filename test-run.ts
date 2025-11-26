/**
 * Test script to run the plugin directly
 * 
 * Usage:
 *   npm run test:run -- WALLET_ADDRESS
 * 
 * Example:
 *   npm run test:run -- 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
 */

import { SwapAnalysisService } from './src/services/swapAnalysisService.js';
import { createHeliusService } from './src/services/api/helius.js';
import { getBirdeyeService } from './src/services/api/birdeyes.js';
import { setGlobalHeliusService, setGlobalBirdeyeService } from './src/services/api/index.js';

// Get wallet address from command line
const walletAddress = process.argv[2];

if (!walletAddress) {
  console.error('❌ Error: Wallet address is required');
  console.log('\nUsage:');
  console.log('  npm run test:run -- WALLET_ADDRESS');
  console.log('\nExample:');
  process.exit(1);
}

// Check for required environment variables
if (!process.env.HELIUS_API_KEY) {
  console.error('❌ Error: HELIUS_API_KEY environment variable is required');
  console.log('\nPlease set it:');
  console.log('  export HELIUS_API_KEY=your_key_here');
  console.log('  or create a .env file');
  process.exit(1);
}

async function runTest() {
  console.log('🚀 Starting Swap Analysis Test...\n');
  console.log(`📝 Wallet Address: ${walletAddress}\n`);

  try {
    // Create services directly
    const heliusService = createHeliusService(
      process.env.HELIUS_API_KEY!,
      50 // RPS
    );
    
    const birdeyeService = getBirdeyeService(
      process.env.BIRDEYE_API_KEY
    );

    setGlobalHeliusService(heliusService);
    setGlobalBirdeyeService(birdeyeService);

    console.log('✅ Services initialized\n');

    // Create SwapAnalysisService directly (no runtime needed)
    const swapService = new SwapAnalysisService(heliusService, birdeyeService);

    console.log('📊 Analyzing wallet swaps...\n');

    // Analyze swaps with price analysis
    const result = await swapService.analyzeWalletSwaps(walletAddress);

    console.log('✅ Analysis complete!\n');
    console.log(`✨ Found ${result.length} swap transactions\n`);

    if (result.length === 0) {
      console.log('ℹ️  No swap transactions found for this wallet address.');
      process.exit(0);
    }

    // Display summary
    console.log('📈 Summary:');
    console.log(`   Total Swaps: ${result.length}`);
    
    let totalVolumes = 0;
    let swapsWithPrice = 0;
    
    result.forEach((tx, index) => {
      console.log(`\n   Transaction ${index + 1}:`);
      console.log(`   Signature: ${tx.signature.toString()}`);
      console.log(`   Timestamp: ${new Date(tx.timestamp * 1000).toISOString()}`);
      console.log(`   Pre Balance: ${tx.preBalance}`);
      console.log(`   Post Balance: ${tx.postBalance}`);
      console.log(`   Volumes: ${tx.volumes.length}`);
      // console.log(`   Volumes ====================>: ${JSON.stringify(tx.volumes)}`);
      
      if (tx.priceAnalysis && tx.priceAnalysis.length > 0) {
        // console.log("🚀 ~ runTest ~ tx.priceAnalysis:", tx.priceAnalysis)
        swapsWithPrice++;
        tx.priceAnalysis.forEach((price: any) => {
          console.log(`   Price Analysis for ${price.mint.toString()}:`);
          console.log(`     Purchase Price: $${price.purchasePrice}`);
          console.log(`     Current Price: $${price.currentPrice}`);
          console.log(`     ATH Price: $${price.athPrice}`);
          console.log(`     Gain/Loss: ${price.gainLoss}%`);
          console.log(`     Missed ATH: ${price.missedATH}%`);
        });
      }
      
      totalVolumes += tx.volumes.length;
    });

    console.log(`\n📊 Overall Statistics:`);
    console.log(`   Total Transactions: ${result.length}`);
    console.log(`   Total Volumes: ${totalVolumes}`);
    console.log(`   Swaps with Price Data: ${swapsWithPrice}`);

    // Optionally output full JSON
    if (process.argv.includes('--json')) {
      console.log('\n📄 Full JSON Output:');
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

runTest();

