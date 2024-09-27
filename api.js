module.exports = {
    async getTimers({ homey }) {
        return homey.app.exportTimers();
    },
    async deleteTimer({ homey, params }) {
        return homey.app.cancelTimer({id: params.id});
    }
}
;
