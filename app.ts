import { HomeyAPI } from "athom-api";

import Homey = require("homey");
import Homey = require("homey");
const { HomeyAPIApp } = require("homey-api");

import Device = HomeyAPI.ManagerDevices.Device;

const DEBUG = process.env.DEBUG === "1";

interface Timer {
  id: NodeJS.Timeout;
  device: Device;
  timeOn: number; // Original duration of the timer in seconds
  startTime: number; // Timestamp when the timer started
  offTime: number; // Timestamp when the timer is supposed to end
  capability: string;
  value: any;
  oldValue: any;
  onOffCapabilityInstance: any;
}

interface StoredTimer {
  deviceId: string;
  timeOn: number;
  startTime: number;
  offTime: number;
  capability: string;
  value: any;
  oldValue: any;
}

interface StoredTimer {
  deviceId: string;
  timeOn: number;
  startTime: number;
  offTime: number;
  capability: string;
  value: any;
  oldValue: any;
}

export default class TimerApp extends Homey.App {
  private timers: { [deviceId: string]: Timer } = {};
  private api: typeof HomeyAPIApp | null = null;
  private cloudUrl: string = "";
  private api: typeof HomeyAPIApp | null = null;
  private cloudUrl: string = "";

  async onInit() {
    this.log(`${this.id} is running...(debug mode ${DEBUG ? "on" : "off"})`);
    if (DEBUG) {
      require("inspector").open(9229, "0.0.0.0");
    }

    // Retrieve the cloudUrl
    const image = await this.homey.images.createImage();
    // @ts-ignore
    this.cloudUrl = image.cloudUrl.split("/api/")[0];
    await image.unregister();

    this.log("Timer App is initializing...");

    // Initialize flow cards
    // Initialize flow cards
    this.initFlowCards();

    // Restore timers from persistent storage
    await this.restoreTimers();

    // Restore timers from persistent storage
    await this.restoreTimers();

    this.log("Timer App is running...");
  }

  /**
   * Initializes all flow cards and registers their respective listeners.
   */
  /**
   * Initializes all flow cards and registers their respective listeners.
   */
  initFlowCards() {
    // Action Card: then_more_on_off
    const thenMoreOnOff = this.homey.flow.getActionCard("then_more_on_off");
    thenMoreOnOff
    // Action Card: then_more_on_off
    const thenMoreOnOff = this.homey.flow.getActionCard("then_more_on_off");
    thenMoreOnOff
      .registerRunListener(async (args: any) => {
        return this.runScript(
          args.device,
          { capability: "onoff", value: true },
          args.time_on,
          args.ignore_when_on,
          args.overrule_longer_timeouts
        );
      });
    this.registerDeviceAutocompleteListener(thenMoreOnOff, 'onoff');

    // Action Card: then_more_dim
    const thenMoreDim = this.homey.flow.getActionCard("then_more_dim");
    thenMoreDim
        return this.runScript(
          args.device,
          { capability: "onoff", value: true },
          args.time_on,
          args.ignore_when_on,
          args.overrule_longer_timeouts
        );
      });
    this.registerDeviceAutocompleteListener(thenMoreOnOff, 'onoff');

    // Action Card: then_more_dim
    const thenMoreDim = this.homey.flow.getActionCard("then_more_dim");
    thenMoreDim
      .registerRunListener(async (args: any) => {
        return this.runScript(
          args.device,
          { capability: "dim", value: args.brightness_level },
          args.time_on,
          args.ignore_when_on,
          args.overrule_longer_timeouts,
          args.restore
        );
      });
    this.registerDeviceAutocompleteListener(thenMoreDim, 'dim');

    // Action Card: cancel_timer
    const cancelTimer = this.homey.flow.getActionCard("cancel_timer");
    cancelTimer
        return this.runScript(
          args.device,
          { capability: "dim", value: args.brightness_level },
          args.time_on,
          args.ignore_when_on,
          args.overrule_longer_timeouts,
          args.restore
        );
      });
    this.registerDeviceAutocompleteListener(thenMoreDim, 'dim');

    // Action Card: cancel_timer
    const cancelTimer = this.homey.flow.getActionCard("cancel_timer");
    cancelTimer
      .registerRunListener((args: any) => {
        return this.cancelTimer(args.device);
      });
    this.registerDeviceAutocompleteListener(cancelTimer, 'onoff');

    // Condition Card: is_timer_running
    const isTimerRunning = this.homey.flow.getConditionCard("is_timer_running");
    isTimerRunning
      });
    this.registerDeviceAutocompleteListener(cancelTimer, 'onoff');

    // Condition Card: is_timer_running
    const isTimerRunning = this.homey.flow.getConditionCard("is_timer_running");
    isTimerRunning
      .registerRunListener(async (args: any) => {
        return args.device.id in this.timers;
      });
    this.registerDeviceAutocompleteListener(isTimerRunning, 'onoff');
  }

  /**
   * Registers an autocomplete listener for a given flow card based on the capability type.
   *
   * @param actionCard - The flow card (action or condition) to register the listener on.
   * @param capabilityType - The type of capability ('onoff' or 'dim') to filter devices.
   */
  private registerDeviceAutocompleteListener(
    actionCard: Homey.FlowCardAction | Homey.FlowCardCondition,
    capabilityType: 'onoff' | 'dim'
  ) {
    actionCard
      });
    this.registerDeviceAutocompleteListener(isTimerRunning, 'onoff');
  }

  /**
   * Registers an autocomplete listener for a given flow card based on the capability type.
   *
   * @param actionCard - The flow card (action or condition) to register the listener on.
   * @param capabilityType - The type of capability ('onoff' or 'dim') to filter devices.
   */
  private registerDeviceAutocompleteListener(
    actionCard: Homey.FlowCardAction | Homey.FlowCardCondition,
    capabilityType: 'onoff' | 'dim'
  ) {
    actionCard
      .getArgument("device")
      .registerAutocompleteListener(async (query: string, args: any) => {
        const devices = capabilityType === 'onoff' ? await this.getOnOffDevices() : await this.getDimDevices();
        const devices = capabilityType === 'onoff' ? await this.getOnOffDevices() : await this.getDimDevices();
        const devicesWithIcons = await Promise.all(
          devices.map(async (device) => {
          devices.map(async (device) => {
            const api = await this.getApi();
            const fullDevice = await api.devices.getDevice({ id: device.id });

            const iconUrl = fullDevice.iconObj?.url && this.cloudUrl ? `${this.cloudUrl}${fullDevice.iconObj.url}` : null;

            return {
              id: fullDevice.id,
              name: fullDevice.name.trim(),
              icon: iconUrl || undefined
              icon: iconUrl || undefined
            };
          })
        );
        const filteredDevices = devicesWithIcons
          .filter((device) => device.name.length > 0)
          .filter((device) => device.name.toLowerCase().includes(query.toLowerCase()))
          .sort((a, b) => a.name.localeCompare(b.name));

        return filteredDevices;
      });
  }

  /**
   * Restores timers from persistent storage and re-establishes them.
   */
  private async restoreTimers() {
    const storedTimers: StoredTimer[] = await this.homey.settings.get('timers') || [];
    const now = Date.now();

    for (const storedTimer of storedTimers) {
      const device = await this.getApi().devices.getDevice({ id: storedTimer.deviceId });
      if (!device) {
        this.log(`Device with ID ${storedTimer.deviceId} not found. Skipping timer restoration.`);
        continue;
      }

      const remainingTime = storedTimer.offTime - now;

      if (remainingTime <= 0) {
        // Timer has already expired while Homey was offline. Execute the timeout action immediately.
        this.log(`Restored timer for device ${device.name} [${device.id}] has already expired. Executing timeout action.`);
        await this.executeTimeoutAction(device, storedTimer);
        continue;
      }

      // Re-establish the timer with the remaining time
      const timeoutId = setTimeout(() => {
        (async () => {
          this.log(`Timeout for ${device.name} [${device.id}]`);

          const currentTimer = this.timers[device.id];
          if (currentTimer && currentTimer.id === timeoutId) {
            this.cleanupTimer(device);

            if (currentTimer.oldValue !== null && currentTimer.oldValue !== undefined) {
              await this.setDeviceCapabilityState(device, currentTimer.capability, currentTimer.oldValue);
            } else {
              if (currentTimer.capability === "onoff") {
                await this.setDeviceCapabilityState(device, "onoff", false);
              } else if (currentTimer.capability === "dim") {
                await this.setDeviceCapabilityState(device, "dim", 0);
              } else {
                await this.setDeviceCapabilityState(device, currentTimer.capability, false);
              }
            }
          } else {
            this.log(`Timer expired for ${device.name} [${device.id}], but it was already canceled or replaced with a new timer.`);
          }
        })().catch((error) => {
          this.log(`Error in timeout function for ${device.name} [${device.id}]: ${error}`);
        });
      }, remainingTime);

      // Re-establish the capability listener
      const capabilityInstance = device.makeCapabilityInstance(storedTimer.capability, (value: any) => {
        if (!value || (storedTimer.capability === "dim" && value === 0)) {
          this.log(`Listener: Device ${device.name} [${device.id}] turned off or dimmed to zero, disabling timer`);
          this.cancelTimer(device);
        }
      });

      // Re-create the timer object with the capabilityInstance
      this.timers[device.id] = {
        id: timeoutId,
        device: device,
        timeOn: storedTimer.timeOn,
        startTime: storedTimer.startTime,
        offTime: storedTimer.offTime,
        capability: storedTimer.capability,
        value: storedTimer.value,
        oldValue: storedTimer.oldValue,
        onOffCapabilityInstance: capabilityInstance
      };

      this.log(`Restored timer for device ${device.name} [${device.id}] with ${remainingTime / 1000} seconds remaining.`);
    }

    // Remove any expired timers from storage
    const validTimers = storedTimers.filter(timer => timer.offTime > now);
    await this.homey.settings.set('timers', validTimers);
  }

  /**
   * Executes the timeout action immediately for expired timers during restoration.
   *
   * @param device - The device associated with the expired timer.
   * @param storedTimer - The stored timer data.
   */
  private async executeTimeoutAction(device: Device, storedTimer: StoredTimer) {
    if (storedTimer.oldValue !== null && storedTimer.oldValue !== undefined) {
      await this.setDeviceCapabilityState(device, storedTimer.capability, storedTimer.oldValue);
    } else {
      if (storedTimer.capability === "onoff") {
        await this.setDeviceCapabilityState(device, "onoff", false);
      } else if (storedTimer.capability === "dim") {
        await this.setDeviceCapabilityState(device, "dim", 0);
      } else {
        await this.setDeviceCapabilityState(device, storedTimer.capability, false);
      }
    }

    // Cleanup the timer, which destroys the capability listener and removes the timer reference
    this.cleanupTimer(device);
  }

  /**
   * Executes the script to set a timer on a device.
   *
   * @param device - The device to set the timer on.
   * @param action - The action to perform (capability and value).
   * @param timeOn - Duration of the timer in seconds.
   * @param ignoreWhenOn - Flag to ignore if the device is already on.
   * @param overruleLongerTimeouts - Flag to overrule longer existing timeouts.
   * @param restore - Flag to restore previous state after timer ends.
   * @returns A promise that resolves to true upon successful execution.
   */
  async runScript(
    device: Device,
    action: { capability: string; value: any },
    timeOn: number,
    ignoreWhenOn: string,
    overruleLongerTimeouts: string,
    restore: string = "no"
  ): Promise<boolean> {
    const api = await this.getApi();
    const apiDevice = await api.devices.getDevice({ id: device.id });
    const deviceCapability = apiDevice.capabilitiesObj[action.capability];
    const timer = this.timers[device.id];

    let oldValue: number | null = null;
    let capabilityInstance = null;

    if (
      deviceCapability.value === false ||
      ignoreWhenOn === "no" ||
      (timer && (overruleLongerTimeouts === "yes" || Date.now() + timeOn * 1000 > timer.offTime))
    ) {
    if (
      deviceCapability.value === false ||
      ignoreWhenOn === "no" ||
      (timer && (overruleLongerTimeouts === "yes" || Date.now() + timeOn * 1000 > timer.offTime))
    ) {
      if (timer) {
        oldValue = timer.oldValue;
        capabilityInstance = timer.onOffCapabilityInstance;

        const remainingTime = Math.max(0, Math.round((timer.offTime - Date.now()) / 1000));
        const previousTimeOn = timer.timeOn;
        this.log(
          `Cancelling previous timer for device ${device.name} [${device.id}], ` +
            `remaining time: ${remainingTime} seconds out of ${previousTimeOn} seconds`
        );
        this.log(
          `Cancelling previous timer for device ${device.name} [${device.id}], ` +
            `remaining time: ${remainingTime} seconds out of ${previousTimeOn} seconds`
        );

        await this.cancelTimer(device);
      } else {
        if (action.capability === "dim" && restore === "yes") {
          oldValue = deviceCapability.value as number;
          this.log(`Remembered state for ${device.name} [${device.id}] oldValue: ${oldValue}`);
        }

        await this.setDeviceCapabilityState(device, action.capability, action.value);

        capabilityInstance = apiDevice.makeCapabilityInstance(action.capability, (value: any) => {
          if (!value || value === 0) {
            this.log(`Listener: Device ${device.name} [${device.id}] turned off or dimmed to zero, disabling timer`);
            this.cancelTimer(device);
          }
        });
      }

      let logMessage = `Set timer for device ${device.name} [${device.id}] to ${timeOn} seconds`;
      if (oldValue !== null && oldValue !== undefined) {
        logMessage += `, oldValue: ${oldValue}`;
      }
      this.log(logMessage);

      const timeoutId = setTimeout(() => {
        (async () => {
          this.log(`Timeout for ${device.name} [${device.id}]`);

          const currentTimer = this.timers[device.id];
          if (currentTimer && currentTimer.id === timeoutId) {
            this.cleanupTimer(device);

            if (currentTimer.oldValue !== null && currentTimer.oldValue !== undefined) {
              await this.setDeviceCapabilityState(device, currentTimer.capability, currentTimer.oldValue);
            if (currentTimer.oldValue !== null && currentTimer.oldValue !== undefined) {
              await this.setDeviceCapabilityState(device, currentTimer.capability, currentTimer.oldValue);
            } else {
              if (currentTimer.capability === "onoff") {
              if (currentTimer.capability === "onoff") {
                await this.setDeviceCapabilityState(device, "onoff", false);
              } else if (currentTimer.capability === "dim") {
              } else if (currentTimer.capability === "dim") {
                await this.setDeviceCapabilityState(device, "dim", 0);
              } else {
                await this.setDeviceCapabilityState(device, currentTimer.capability, false);
                await this.setDeviceCapabilityState(device, currentTimer.capability, false);
              }
            }
          } else {
            this.log(`Timer expired for ${device.name} [${device.id}], but it was already canceled or replaced with a new timer.`);
          }
        })().catch((error) => {
          this.log(`Error in timeout function for ${device.name} [${device.id}]: ${error}`);
        });
      }, timeOn * 1000);

      // Store the timer with additional information
      this.timers[device.id] = {
        id: timeoutId,
        device: device,
        timeOn: timeOn,
        startTime: Date.now(),
        offTime: Date.now() + timeOn * 1000,
        capability: action.capability,
        value: action.value,
        oldValue: oldValue,
        onOffCapabilityInstance: capabilityInstance
      };

      // Save the current timers to persistent storage
      await this.saveTimers();

      // Save the current timers to persistent storage
      await this.saveTimers();

      this.homey.api.realtime("timer_started", {
        timers: this.exportTimers(),
        device: device,
        capability: action.capability,
        value: action.value,
        oldValue: oldValue
      });
    }

    return true;
  }

  /**
   * Cancels an existing timer for a given device.
   *
   * @param device - The device whose timer is to be canceled.
   * @returns A promise that resolves to true upon successful cancellation.
   */
  /**
   * Cancels an existing timer for a given device.
   *
   * @param device - The device whose timer is to be canceled.
   * @returns A promise that resolves to true upon successful cancellation.
   */
  async cancelTimer(device: Device) {
    const timer = this.timers[device.id];
    // if timer is running cancel timer and remove reference
    if (timer) {
      clearTimeout(timer.id);
      this.log(`Cancelled timer for device ${device.name} [${device.id}]`);
      this.cleanupTimer(device);
    } else {
      this.log(`WARNING: No timer to Cancel for device ${device.name} [${device.id}]`);
    }

    // Save the current timers to persistent storage
    await this.saveTimers();

    // Save the current timers to persistent storage
    await this.saveTimers();

    return Promise.resolve(true);
  }

  /**
   * Cleans up the timer by removing listeners and references.
   *
   * @param device - The device whose timer is to be cleaned up.
   */
  /**
   * Cleans up the timer by removing listeners and references.
   *
   * @param device - The device whose timer is to be cleaned up.
   */
  cleanupTimer(device: Device): void {
    const timer = this.timers[device.id];
    if (timer) {
      // Clean up listener for off-state
      if (timer.onOffCapabilityInstance && typeof timer.onOffCapabilityInstance.destroy === 'function') {
        timer.onOffCapabilityInstance.destroy();
      }
      // Remove reference of timer for this device
      delete this.timers[device.id];
      // Emit event to signal settings page the timer can be removed
      // Emit event to signal settings page the timer can be removed
      this.homey.api.realtime("timer_deleted", {
        timers: this.exportTimers(),
        device: device
      });
    } else {
      this.log(`WARNING: No timer to cleanup for device ${device.name} [${device.id}]`);
    }
  }

  /**
   * Sets a device's capability to a specified value.
   *
   * @param device - The device to be updated.
   * @param capabilityId - The capability to be set.
   * @param value - The value to set the capability to.
   */
  /**
   * Sets a device's capability to a specified value.
   *
   * @param device - The device to be updated.
   * @param capabilityId - The capability to be set.
   * @param value - The value to set the capability to.
   */
  async setDeviceCapabilityState(device: Device, capabilityId: string, value: any) {
    this.log(`Set device ${device.name} [${device.id}] capability ${capabilityId} to ${value}`);
    try {
      const api = await this.getApi();
      await api.devices.setCapabilityValue({
        deviceId: device.id,
        capabilityId: capabilityId,
        value: value
      });
      // Update cache of apiDevice.capabilitiesObj
      const apiDevice = await api.devices.getDevice({ id: device.id });
      apiDevice.capabilitiesObj[capabilityId].value = value;
    } catch (error) {
      this.log(`Error setting capability value: ${error}`);
    }
  }

  /**
   * Retrieves the Homey API instance. Initializes it if not already done.
   *
   * @returns The Homey API instance.
   */
  /**
   * Retrieves the Homey API instance. Initializes it if not already done.
   *
   * @returns The Homey API instance.
   */
  getApi(): typeof HomeyAPIApp {
    if (!this.api) {
      this.api = new HomeyAPIApp({
        homey: this.homey
      });
    }
    return this.api;
  }

  /**
   * Exports the current timers without the timeout IDs.
   *
   * @returns An object representing the current timers.
   */
  /**
   * Exports the current timers without the timeout IDs.
   *
   * @returns An object representing the current timers.
   */
  exportTimers() {
    let data: any = {};
    // Clone timers, and remove the timeout-id
    for (let key in this.timers) {
      data[key] = Object.assign({}, this.timers[key]);
      delete data[key].id; // Remove timeout id which cannot be exported
    }
    return data;
  }

  /**
   * Saves the current timers to persistent storage.
   */
  private async saveTimers() {
    const storedTimers: StoredTimer[] = Object.values(this.timers).map(timer => ({
      deviceId: timer.device.id,
      timeOn: timer.timeOn,
      startTime: timer.startTime,
      offTime: timer.offTime,
      capability: timer.capability,
      value: timer.value,
      oldValue: timer.oldValue
    }));
    await this.homey.settings.set('timers', storedTimers);
  }

  /**
   * Retrieves all devices from Homey.
   *
   * @returns A promise that resolves to an array of all devices.
   */
  /**
   * Saves the current timers to persistent storage.
   */
  private async saveTimers() {
    const storedTimers: StoredTimer[] = Object.values(this.timers).map(timer => ({
      deviceId: timer.device.id,
      timeOn: timer.timeOn,
      startTime: timer.startTime,
      offTime: timer.offTime,
      capability: timer.capability,
      value: timer.value,
      oldValue: timer.oldValue
    }));
    await this.homey.settings.set('timers', storedTimers);
  }

  /**
   * Retrieves all devices from Homey.
   *
   * @returns A promise that resolves to an array of all devices.
   */
  async getAllDevices(): Promise<Device[]> {
    const api = await this.getApi();
    const devices: { [id: string]: Device } = await api.devices.getDevices();
    return Object.values(devices);
  }

  /**
   * Loads all devices from Homey and filters those without the on/off capability.
   *
   * @returns A promise that resolves to an array of devices with the on/off capability.
   * Loads all devices from Homey and filters those without the on/off capability.
   *
   * @returns A promise that resolves to an array of devices with the on/off capability.
   */
  async getOnOffDevices(): Promise<Device[]> {
    const allDevices = await this.getAllDevices();

    return allDevices.filter((device) => {
      return (
        device.capabilitiesObj &&
        "onoff" in device.capabilitiesObj &&
        // @ts-ignore
        device.capabilitiesObj.onoff.setable
      );
    });
  }

  /**
   * Loads all devices from Homey and filters those without the dim capability.
   *
   * @returns A promise that resolves to an array of devices with the dim capability.
   * Loads all devices from Homey and filters those without the dim capability.
   *
   * @returns A promise that resolves to an array of devices with the dim capability.
   */
  async getDimDevices(): Promise<Device[]> {
    const allDevices = await this.getAllDevices();

    return allDevices.filter((device) => {
      return (
        device.capabilitiesObj &&
        "dim" in device.capabilitiesObj &&
        // @ts-ignore
        device.capabilitiesObj.dim.setable
      );
    });
  }
}

module.exports = TimerApp;
