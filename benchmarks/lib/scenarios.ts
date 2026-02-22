import { ScenarioConfig } from './types.js'

function generateIPs(count: number): string[] {
  const ips = new Array<string>(count)
  for (let i = 0; i < count; i++) {
    ips[i] = `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`
  }
  return ips
}

export const scenarios: ScenarioConfig[] = [
  {
    name: 'single-ip',
    description: 'Single IP, best cache locality',
    keys: ['192.168.1.1']
  },
  {
    name: 'multi-ip-1k',
    description: '1,000 unique IPs, typical API',
    keys: generateIPs(1000)
  },
  {
    name: 'multi-ip-10k',
    description: '10,000 unique IPs, high traffic',
    keys: generateIPs(10000)
  }
]
