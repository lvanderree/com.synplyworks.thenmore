'use strict';

const Homey = require('homey');
const { HomeyAPI  } = require('athom-api')

class ThenMoreApp extends Homey.App {
	
	onInit() {
		this.log('ThenMore App is initializing...')

		this.cache = {}
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
			
		// this.getOnOffDevices() // TODO: init for drop down
		this.initFlowCards()
		
		this.log('ThenMore App is running...')
	}

	initFlowCards() {
		new Homey.FlowCardAction('then_more_dim')
			.register()
			.registerRunListener( args => {
				return this.runScript( args.device.id );
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getDimDevices().then( dimDevices => {
						let filteredResults = dimDevices.filter( device => {
							return device.name.toLowerCase().indexOf( query.toLowerCase() ) > -1;
						})

						return Promise.resolve(filteredResults);
					})
			})

		new Homey.FlowCardAction('then_more_on_off')
			.register()
			.registerRunListener( args => {
				return this.runScript( args.device.id );
			})
			.getArgument('device')
				.registerAutocompleteListener( (query, args) => {
					return this.getOnOffDevices().then( onOffDevices => {
						let filteredResults = onOffDevices.filter( device => {
							return device.name.toLowerCase().indexOf(query.toLowerCase()) > -1;
						})

						return Promise.resolve(filteredResults);
					})
			})

	}

	async runScript(deviceId) {
		return new Homey.Notification({
			excerpt: 'Doe iets met device ' + deviceId
		}).register()
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