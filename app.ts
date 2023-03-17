import {HomeyAPI} from "athom-api";

const Homey = require('homey');
const {HomeyAPIApp} = require('homey-api');

import Device = HomeyAPI.ManagerDevices.Device;


const DEBUG = process.env.DEBUG === '1';


export default class TimerApp extends Homey.App {
    onInit() {
        this.log(`${this.id} is running...(debug mode ${DEBUG ? 'on' : 'off'})`);
        if (DEBUG) {
            require('inspector').open(9229, '0.0.0.0');
        }

        this.log('Timer App is initializing...');

        // remember timeoutIds per device
        this.timers = [];
        this.initFlowCards();

        this.log('Timer App is running...');
    }

    initFlowCards() {
        this.homey.flow.getActionCard('then_more_on_off')
            // eslint-disable-next-line no-unused-vars
            .registerRunListener(async (args: any) => {
                return this.runScript(
                    args.device,
                    {'capability': 'onoff', 'value': true},
                    args.time_on,
                    args.ignore_when_on,
                    args.overrule_longer_timeouts
                );
            })
            .getArgument('device')
            // eslint-disable-next-line no-unused-vars
            .registerAutocompleteListener(async (query: string, args: any) => {
                return this.getOnOffDevices().then(onOffDevices => {
                    // filter key that have a matching name
                    return onOffDevices.filter(device => {
                        return (
                            device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
                        );
                    });
                });
            });

        this.homey.flow.getActionCard('then_more_dim')
            // eslint-disable-next-line no-unused-vars
            .registerRunListener(async (args: any) => {
                return this.runScript(
                    args.device,
                    {'capability': 'dim', 'value': args.brightness_level},
                    args.time_on,
                    args.ignore_when_on,
                    args.overrule_longer_timeouts,
                    args.restore
                );
            })
            // TODO: DRY registerAutocompleteListener
            .getArgument('device')
            // eslint-disable-next-line no-unused-vars
            .registerAutocompleteListener(async (query: string, args: any) => {
                return this.getDimDevices().then(dimDevices => {
                    // filter devices that have a matching name
                    return dimDevices.filter(device => {
                        return (
                            device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
                        );
                    });
                });
            });

        this.homey.flow.getActionCard('cancel_timer')
            // eslint-disable-next-line no-unused-vars
            .registerRunListener((args: any) => {
                return this.cancelTimer(
                    args.device
                );
            })
            .getArgument('device')
            // eslint-disable-next-line no-unused-vars
            .registerAutocompleteListener(async (query: string) => {
                return this.getOnOffDevices().then(onOffDevices => {
                    return onOffDevices.filter(device => {
                        return (
                            device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
                        );
                    });
                });
            });

        this.homey.flow.getConditionCard('is_timer_running')
            .registerRunListener(async (args: any) => {
                if (args.device.id in this.timers) {
                    return true;
                } else {
                    return false;
                }
            })
            .getArgument('device')
            // eslint-disable-next-line no-unused-vars
            .registerAutocompleteListener(async (query: string) => {
                return this.getOnOffDevices().then(onOffDevices => {
                    return onOffDevices.filter(device => {
                        return (
                            device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
                        );
                    });
                });
            });
    }

    async runScript(device: Device, action: { capability: string; value: any }, timeOn: any, ignoreWhenOn: any, overruleLongerTimeouts: any, restore: string = "no") {
        const api = await this.getApi();
        const apiDevice = await api.devices.getDevice({id: device.id});
        const deviceOnoff = apiDevice.capabilitiesObj.onoff;
        const timer = this.timers[device.id];

        let oldValue = null;
        let onOffCapabilityInstance = null;

        // run script when...
        if (
            // ... device is off
            (deviceOnoff.value == false) ||
            // ... or ignoring current on-state
            (ignoreWhenOn == "no") ||
            // .. or when previously activated by this script AND overrule longer enabled, or new timer is later
            (
                timer &&
                ((overruleLongerTimeouts == "yes") || (new Date().getTime() + timeOn * 1000 > timer.offTime))
            )
        ) {
            // first check if there is a reference for a running timer for this device
            if (timer) {
                // timer already running, device already on, but disable running timer
                oldValue = timer.oldValue; // restore oldValue
                onOffCapabilityInstance = timer.onOffCapabilityInstance; // restore listener instance
                await this.cancelTimer(device);
            } else {
                // if timer is not already running, set device to desired on state

                // if restore is set to true and the device is already on, remember current value (as oldValue)
                if (restore == "yes" && deviceOnoff.value) {
                    oldValue = apiDevice.capabilitiesObj[action.capability].value;
                    this.log(`remember state for ${device.name} [${device.id}] (since on and restore on) oldValue ${oldValue}`);
                }

                // turn device on, according to chosen action-card/capability
                this.setDeviceCapabilityState(device, action.capability, action.value);

                // register listener to clean-up timer when off-state triggered
                onOffCapabilityInstance = apiDevice.makeCapabilityInstance('onoff', function (this: TimerApp, device: Device, value: boolean) {
                    if (!value) {
                        this.log(`Listener: Device ${device.name} [${device.id}] turned off, disable running timer`);
                        this.cancelTimer(device);
                    }
                }.bind(this, device));
            }

            // (re)set timeout, with following functionality
            this.log(`set timer for device ${device.name} [${device.id}] to ${timeOn} seconds, oldValue: ${oldValue ? oldValue : false}`);
            let timeoudId = setTimeout(function (this: TimerApp, device: Device, capabilityId: string , oldValue: any) {
                this.log(`Timeout for ${device.name} [${device.id}]`);

                const timer = this.timers[device.id];
                if (timer) {
                    this.cleanupTimer(device);

                    // turn device off, or restore to previous state
                    if (!oldValue) {
                        this.setDeviceCapabilityState(device, 'onoff', false);
                    } else {
                        this.setDeviceCapabilityState(device, capabilityId, oldValue);
                    }

                } else {
                    this.log(`WARNING: timer timed out, but no timer for device ${device.name} [${device.id}] found! already fired?`);
                }
            }.bind(this, device, action.capability, oldValue), timeOn * 1000);

            // remember reference of timer for this device and when it will end
            this.timers[device.id] = {
                id: timeoudId,
                device: device,
                offTime: new Date().getTime() + timeOn * 1000,
                capability: action.capability,
                value: action.value,
                oldValue: oldValue,
                onOffCapabilityInstance: onOffCapabilityInstance
            };
            // tell the world the timer is (re)started
            this.homey.api.realtime('timer_started', {
                timers: this.exportTimers(),
                device: device,
                capability: action.capability,
                value: action.value,
                oldValue: oldValue
            });
        }

        return Promise.resolve(true);
    }

    cancelTimer(device: Device) {
        const timer = this.timers[device.id];
        // if timer is running cancel timer and remove reference
        if (timer) {
            clearTimeout(timer.id);
            this.log(`Cancelled timer for device ${device.name} [${device.id}]`);

            this.cleanupTimer(device);
        } else {
            this.log(`WARNING: No timer to Cancel for device ${device.name} [${device.id}]`);
        }

        return Promise.resolve(true);
    }

    cleanupTimer(device: Device) {
        const timer = this.timers[device.id];
        if (timer) {
            // clean up listener for off-state
            timer.onOffCapabilityInstance.destroy();
            // remove reference of timer for this device
            delete this.timers[device.id];
            // emit event to signal settings page the timer can be removed
            this.homey.api.realtime('timer_deleted', {timers: this.exportTimers(), device: device});
        } else {
            this.log(`WARNING: No timer to cleanup for device ${device.name} [${device.id}]`);
        }
    }

    // set a device to a certain state
    async setDeviceCapabilityState(device: Device, capabilityId: string, value: any) {
        this.log(`set device ${device.name} [${device.id}] capability ${capabilityId} to ${value}`);

        const api = await this.getApi();
        await api.devices.setCapabilityValue({deviceId: device.id, capabilityId: capabilityId, value: value});

        // update cache of apiDevice.capabilitiesObj
        const apiDevice = await api.devices.getDevice({id: device.id});
        apiDevice.capabilitiesObj[capabilityId].value = value;
    }

    // Get API control function
    getApi(): typeof HomeyAPIApp {
        if (!this.api) {
            this.api = new HomeyAPIApp({
                homey: this.homey,
            });
        }

        return this.api;
    }

    // Get Timers
    exportTimers() {
        let data: any = {};

        // clone timers, and remove the timeout-id
        for (let key in this.timers) {
            data[key] = Object.assign({}, this.timers[key]);
            delete data[key].id; // remove timeout id which cannot be exported
        }

        return data;
    }

    // Get all devices function for API
    async getAllDevices(): Promise<Device[]> {
        const api = await this.getApi();

        return Object.values(await api.devices.getDevices());
    }

    /**
     * load all devices from Homey
     * and filter all without on/off capability
     */
    async getOnOffDevices(): Promise<Device[]> {
        return (await this.getAllDevices()).filter((device: Device) => {
            return (
                device.capabilitiesObj !== null &&
                'onoff' in device.capabilitiesObj &&
                // @ts-ignore
                device.capabilitiesObj.onoff.setable
            );
        });
    }

    /**
     * load all devices from Homey
     * and filter all without dim capability
     */
    async getDimDevices() {
        return (await this.getAllDevices()).filter(device => {
            return (
                device.capabilitiesObj !== null &&
                'dim' in device.capabilitiesObj &&
                // @ts-ignore
                device.capabilitiesObj.dim.setable
            );
        });
    }
}

module.exports = TimerApp;
