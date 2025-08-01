import { FullConfig } from '@playwright/test'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global E2E test teardown...')
  
  // Clean test database
  await cleanTestDatabase()
  
  // Clean authentication files
  await cleanAuthFiles()
  
  // Clean uploaded files
  await cleanTestFiles()
  
  // Generate test reports
  await generateTestReports()
  
  console.log('✅ Global E2E test teardown completed')
}

async function cleanTestDatabase() {
  console.log('🧹 Cleaning test database...')
  
  try {
    // Clean test data but preserve schema
    execSync('NODE_ENV=test tsx src/test/e2e/clean-test-data.ts', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../../')
    })
    
    console.log('✅ Test database cleanup completed')
  } catch (error) {
    console.warn('⚠️ Test database cleanup failed (non-critical):', error)
  }
}

async function cleanAuthFiles() {
  console.log('🔐 Cleaning authentication files...')
  
  const authDir = path.resolve(__dirname, './auth')
  
  try {
    if (fs.existsSync(authDir)) {
      const authFiles = fs.readdirSync(authDir)
      
      for (const file of authFiles) {
        if (file.endsWith('-auth.json')) {
          fs.unlinkSync(path.join(authDir, file))
        }
      }
    }
    
    console.log('✅ Authentication files cleanup completed')
  } catch (error) {
    console.warn('⚠️ Authentication files cleanup failed (non-critical):', error)
  }
}

async function cleanTestFiles() {
  console.log('📁 Cleaning test files...')
  
  const testUploadsDir = path.resolve(__dirname, '../../../uploads/test')
  const testPhotosDir = path.resolve(__dirname, '../../../storage/photos/test')
  
  try {
    // Clean test uploads
    if (fs.existsSync(testUploadsDir)) {
      fs.rmSync(testUploadsDir, { recursive: true, force: true })
    }
    
    // Clean test photos
    if (fs.existsSync(testPhotosDir)) {
      fs.rmSync(testPhotosDir, { recursive: true, force: true })
    }
    
    console.log('✅ Test files cleanup completed')
  } catch (error) {
    console.warn('⚠️ Test files cleanup failed (non-critical):', error)
  }
}

async function generateTestReports() {
  console.log('📊 Generating test reports...')
  
  try {
    // Generate Allure report if results exist
    const allureResultsDir = path.resolve(__dirname, '../../../test-results/allure-results')
    
    if (fs.existsSync(allureResultsDir)) {
      execSync('npx allure generate test-results/allure-results -o test-results/allure-report --clean', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../../../')
      })
      
      console.log('📊 Allure report generated at test-results/allure-report')
    }
    
    // Copy HTML report to a permanent location for CI
    const htmlReportDir = path.resolve(__dirname, '../../../test-results/html-report')
    const permanentReportDir = path.resolve(__dirname, '../../../test-results/final-report')
    
    if (fs.existsSync(htmlReportDir)) {
      fs.cpSync(htmlReportDir, permanentReportDir, { recursive: true })
      console.log('📊 HTML report copied to test-results/final-report')
    }
    
    console.log('✅ Test reports generation completed')
  } catch (error) {
    console.warn('⚠️ Test reports generation failed (non-critical):', error)
  }
}

export default globalTeardown