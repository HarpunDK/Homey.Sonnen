import { RingBuffer } from 'ring-buffer-ts';

interface CycleCountSnapshot {
  timestamp: Date;
  cycleCount: number;
}

export class SonnenState {
  lastUpdate: Date | null;
  lastBatteryDataUpdate: Date | null;
  totalDailyToBattery_Wh: number;
  totalDailyFromBattery_Wh: number;
  totalDailyProduction_Wh: number;
  totalDailyConsumption_Wh: number;
  totalDailyGridFeedIn_Wh: number;
  totalDailyGridConsumption_Wh: number;
  totalToBattery_Wh: number;
  totalFromBattery_Wh: number;
  totalProduction_Wh: number;
  totalConsumption_Wh: number;
  totalGridFeedIn_Wh: number;
  totalGridConsumption_Wh: number;
  todayMaxConsumption_Wh: number;
  todayMinConsumption_Wh: number;
  todayMaxGridFeedIn_Wh: number;
  todayMaxGridConsumption_Wh: number;
  todayMaxProduction_Wh: number;
  total_cycleCount: number;
  private cycleCount7DayBuffer: RingBuffer<CycleCountSnapshot>;
  private cycleCount30DayBuffer: RingBuffer<CycleCountSnapshot>;

  constructor(initialState?: Partial<SonnenState>) {
    this.lastUpdate = initialState?.lastUpdate || null;
    this.lastBatteryDataUpdate = initialState?.lastBatteryDataUpdate || null;
    this.totalDailyToBattery_Wh = initialState?.totalDailyToBattery_Wh || 0;
    this.totalDailyFromBattery_Wh = initialState?.totalDailyFromBattery_Wh || 0;
    this.totalDailyProduction_Wh = initialState?.totalDailyProduction_Wh || 0;
    this.totalDailyConsumption_Wh = initialState?.totalDailyConsumption_Wh || 0;
    this.totalDailyGridFeedIn_Wh = initialState?.totalDailyGridFeedIn_Wh || 0;
    this.totalDailyGridConsumption_Wh = initialState?.totalDailyGridConsumption_Wh || 0;
    this.totalToBattery_Wh = initialState?.totalToBattery_Wh || 0;
    this.totalFromBattery_Wh = initialState?.totalFromBattery_Wh || 0;
    this.totalProduction_Wh = initialState?.totalProduction_Wh || 0;
    this.totalConsumption_Wh = initialState?.totalConsumption_Wh || 0;
    this.totalGridFeedIn_Wh = initialState?.totalGridFeedIn_Wh || 0;
    this.totalGridConsumption_Wh = initialState?.totalGridConsumption_Wh || 0;
    this.todayMaxConsumption_Wh = initialState?.todayMaxConsumption_Wh || 0;
    this.todayMinConsumption_Wh = initialState?.todayMinConsumption_Wh || Number.MAX_SAFE_INTEGER;
    this.todayMaxGridFeedIn_Wh = initialState?.todayMaxGridFeedIn_Wh || 0;
    this.todayMaxGridConsumption_Wh = initialState?.todayMaxGridConsumption_Wh || 0;
    this.todayMaxProduction_Wh = initialState?.todayMaxProduction_Wh || 0;
    this.total_cycleCount = initialState?.total_cycleCount || 0;
    
    // Initialize ring buffers for cycle count tracking
    // 7 days * 24 hours = 168 entries
    this.cycleCount7DayBuffer = new RingBuffer<CycleCountSnapshot>(168);
    // 30 days * 24 hours = 720 entries
    this.cycleCount30DayBuffer = new RingBuffer<CycleCountSnapshot>(720);
  }

  /**
   * Create a SonnenState instance from a plain object, properly deserializing Date objects
   * @param obj Plain object with potential string dates
   * @returns Properly deserialized SonnenState instance
   */
  static fromObject(obj: any): SonnenState {
    if (!obj) {
      return new SonnenState();
    }
    
    // Create a deep copy to avoid modifying the original
    const stateCopy = JSON.parse(JSON.stringify(obj));
    
    // Convert date strings back to Date objects
    if (stateCopy.lastUpdate && typeof stateCopy.lastUpdate === 'string') {
      stateCopy.lastUpdate = new Date(stateCopy.lastUpdate);
    }
    
    stateCopy.lastBatteryDataUpdate = null; // transient property, do not restore
    
    // Handle ring buffers that may contain CycleCountSnapshot objects with string timestamps
    if (stateCopy.cycleCount7DayBuffer && stateCopy.cycleCount7DayBuffer.buffer) {
      for (let i = 0; i < stateCopy.cycleCount7DayBuffer.buffer.length; i++) {
        const snapshot = stateCopy.cycleCount7DayBuffer.buffer[i];
        if (snapshot && snapshot.timestamp && typeof snapshot.timestamp === 'string') {
          snapshot.timestamp = new Date(snapshot.timestamp);
        }
      }
    }
    
    if (stateCopy.cycleCount30DayBuffer && stateCopy.cycleCount30DayBuffer.buffer) {
      for (let i = 0; i < stateCopy.cycleCount30DayBuffer.buffer.length; i++) {
        const snapshot = stateCopy.cycleCount30DayBuffer.buffer[i];
        if (snapshot && snapshot.timestamp && typeof snapshot.timestamp === 'string') {
          snapshot.timestamp = new Date(snapshot.timestamp);
        }
      }
    }
    
    return new SonnenState(stateCopy);
  }

  updateState(newState: Partial<SonnenState>) {
    Object.assign(this, newState);
  }

  addCycleCountSnapshot(timestamp: Date, cycleCount: number): void {
    const snapshot: CycleCountSnapshot = { timestamp, cycleCount };
    this.cycleCount7DayBuffer.add(snapshot);
    this.cycleCount30DayBuffer.add(snapshot);
  }

  get7DayAverageCycleCountRate(): number | null {
    return this.calculateAverageCycleCountRate(this.cycleCount7DayBuffer);
  }

  get30DayAverageCycleCountRate(): number | null {
    return this.calculateAverageCycleCountRate(this.cycleCount30DayBuffer);
  }

  private calculateAverageCycleCountRate(buffer: RingBuffer<CycleCountSnapshot>): number | null {
    // Check if we have at least 2 entries
    if (buffer.getSize() < 2) {
      return null;
    }
    
    // Use the first and last snapshots to calculate the rate
    const firstSnapshot = buffer.getFirst();
    const lastSnapshot = buffer.getLast();
    
    // Handle case where first or last snapshot might be undefined
    if (!firstSnapshot || !lastSnapshot) {
      return null;
    }
    
    // Calculate time difference in days
    const timeDiffMs = lastSnapshot.timestamp.getTime() - firstSnapshot.timestamp.getTime();
    const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);
    
    if (timeDiffDays <= 0) {
      return null;
    }
    
    // Calculate rate (cycles per day)
    const cycleDiff = lastSnapshot.cycleCount - firstSnapshot.cycleCount;
    return cycleDiff / timeDiffDays;
  }
}