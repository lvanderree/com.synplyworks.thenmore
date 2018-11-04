'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')

class ThenMoreApp extends Homey.App {
	
	onInit() {
		this.log('ThenMore App is initializing...')

		// remember timeoutIds per device
		this.timers = []

		this.cache = {}
		// invalidate cache when devices are added/removed
		this.getApi().then(api => {
			api.devices.on('device.create', async(id) => {
				await console.log('New device added, reset cache!')
				this.cache = {}
			})
			api.devices.on('device.delete', async(id) => {
				await console.log('Device deleted, reset cache!')
				this.cache = {}
			})
		})
			
		this.initFlowCards()

		this.log('ThenMore App is running...')
	}

	initFlowCards() {
		new Homey.FlowCardAction('then_more_dim')
			.register()
			.registerRunListener( args => {
				return this.runScript( 
					args.device.id, 
					{ 'capability': 'dim', 'value': args.brightness_level },
					args.time_on,
					args.ignore_when_on,
					args.overrule_longer_timeouts,
					args.restore
				);
			})
			// TODO: DRY registerAutocompleteListener
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getDimDevices().then( dimDevices => {
						let filteredResults = dimDevices.filter( device => {
							return (
								device.name.toLowerCase().indexOf( query.toLowerCase() ) > -1
							) || (
								device.zone.name.toLowerCase().indexOf( query.toLowerCase() ) > -1
							)
						})

						return Promise.resolve(filteredResults);
					})
				})


		new Homey.FlowCardAction('then_more_on_off')
			.register()
			.registerRunListener( args => {
				return this.runScript( 
					args.device.id, 
					{ 'capability': 'onoff', 'value': true },
					args.time_on,
					args.ignore_when_on,
					args.overrule_longer_timeouts
				);
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getOnOffDevices().then( onOffDevices => {
						let filteredResults = onOffDevices.filter( device => {
							return (
								device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							) || ( 
								device.zone.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							)
						})

						return Promise.resolve(filteredResults);
					})
				})

		new Homey.FlowCardAction('cancel_timer')
			.register()
			.registerRunListener( args => {
				return this.cancelTimer( 
					args.device.id, 
				);
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getOnOffDevices().then( onOffDevices => {
						let filteredResults = onOffDevices.filter( device => {
							return (
								device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							) || ( 
								device.zone.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							)
						})

						return Promise.resolve(filteredResults);
					})
				})
			
		new Homey.FlowCardCondition('is_timer_running')
			.register()
			.on('run', ( args, state, callback ) => {
				if (this.isTimerRunning(args.device.id)) {
					callback( null, true )
				}
				else {
					callback( null, false )
				}
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getOnOffDevices().then( onOffDevices => {
						let filteredResults = onOffDevices.filter( device => {
							return (
								device.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							) || ( 
								device.zone.name.toLowerCase().indexOf(query.toLowerCase()) > -1
							)
						})

						return Promise.resolve(filteredResults);
					})
				})
	}

	async runScript(deviceId, action, timeOn, ignoreWhenOn, overruleLongerTimeouts, restore = "no") {

		const api = await this.getApi();
		let oldValue = null;

		// run script when...
		if (
			// ... ignoring current on-state
			(ignoreWhenOn == "no") ||
			// .. or when previously activated by this script (and when overrule longer, or new timer is later)
			(
				deviceId in this.timers && 
				((overruleLongerTimeouts == "yes") || (new Date().getTime() + timeOn * 1000 > this.timers[deviceId].offTime))
			) ||
			// or when device is off
			(await api.devices.getDeviceCapabilityState({id: deviceId, capability: 'onoff'}) == false)
		) { 
			// first check if there is a reference for a running timer for this device
			if (this.isTimerRunning(deviceId)) {
				this.cancelTimer(deviceId)
			} else {
				// if not already running, turn device on (else leaf it as it is)
				this.log(`Turn ${deviceId} on`);
				// if restore is set to on, and the device is currently on, remember current value
				if (restore == "yes" && await api.devices.getDeviceCapabilityState({id: deviceId, capability: 'onoff'})) {
					this.log(`remember state for ${deviceId} (since on and restore on)`);
					oldValue = await api.devices.getDeviceCapabilityState({id: deviceId, capability: action.capability});
				}
				await api.devices.setDeviceCapabilityState({id: deviceId, capability: action.capability, value: action.value});
			}
			
			// (re)set timeout
			let timeoudId = setTimeout(function (deviceId, capability, oldValue) {
				if (!oldValue) {
					this.turnOff(deviceId);
				} else {
					this.setDeviceCapabilityState(deviceId, capability, oldValue)
				}
				
				// remove reference of timer for this device
				delete this.timers[deviceId];
			}.bind(this, deviceId, action.capability, oldValue), timeOn * 1000);
			
			// remember reference of timer for this device and when it will end
			this.timers[deviceId] = {id: timeoudId, end_time: new Date().getTime() + timeOn * 1000};
		}
			
		return Promise.resolve(true)
	}

	isTimerRunning(deviceId) {
		let hasTimer = deviceId in this.timers;
		
		if (hasTimer) {
			this.log(`Timer for device ${deviceId} found` );
		} else {
			this.log(`Timer for device ${deviceId} not found` );
		}
		return hasTimer;
	}

	cancelTimer(deviceId) {
		this.log(`Trying to cancel timer for device ${deviceId}`);

		if (deviceId in this.timers) {
			// if timer is running cancel timer and remove reference
			clearTimeout(this.timers[deviceId].id);
			this.log(`Cancelled timer for device ${deviceId}`);
			delete this.timers[deviceId];
		}

		return Promise.resolve(true)
	}

	// turn of a device
	turnOff(deviceId) {
		this.setDeviceCapabilityState(deviceId, 'onoff', false)
	}

	// set a device to a certain state
	async setDeviceCapabilityState(deviceId, capability, value) {
		this.log(`set device ${deviceId} - ${capability} to ${value}!!` );

		const api = await this.getApi();
		await api.devices.setDeviceCapabilityState({id: deviceId, capability: capability, value: value});
	}
		
	// Get API control function
	getApi() {
		if (!this.api) {
			this.api = HomeyAPI.forCurrentHomey();
		}

		return this.api;
	}

	// Get all devices function for API
	async getAllDevices() {
		if (!this.cache.allDevices) {
			const api = await this.getApi();

			this.cache.allDevices = Object.values(await api.devices.getDevices())
			this.log(`Update ${this.cache.allDevices.length} devices in total in cache`)
		}
		
		return this.cache.allDevices;
	}

	/**
	 * load all devices from Homey
	 * and filter all without on/off capability
	 */
	async getOnOffDevices() {
		if (!this.cache.onOffDevices)	{ 
			this.cache.onOffDevices = (await this.getAllDevices()).filter(device => {
				return (
					'onoff' in device.capabilities &&
					device.capabilities.onoff.setable
				)
			});

			this.log(`Update ${this.cache.onOffDevices.length} OnOff devices in cache`)
		}

		return this.cache.onOffDevices;
	}

	/**
	 * load all devices from Homey
	 * and filter all without on/off capability
	 */
	async getDimDevices() {
		if (!this.cache.dimDevices)	{ 
			this.cache.dimDevices = (await this.getAllDevices()).filter(device => {
				return (
					'dim' in device.capabilities &&
					device.capabilities.dim.setable
				)
			});
			
			this.log(`Update ${this.cache.dimDevices.length} Dimable devices in cache`)
		}

		return this.cache.dimDevices;
	}

}

module.exports = ThenMoreApp;