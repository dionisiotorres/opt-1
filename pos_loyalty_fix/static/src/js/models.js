odoo.define('loyality_point_history.models', function (require) {
"use strict";
    var core = require('web.core');
    var QWeb = core.qweb;
    var _t = core._t;
    
    var models = require('point_of_sale.models');

    models.load_fields('res.partner', ['reward_applicable', 'mem_no', 'mem_join_date', 'mem_exp_date', 'mem_type', 'loyalty_id']);

    models.load_models([{
        model: 'pos.mem.type',
        fields: ['name'],
        domain: function(self){ return [];},
        loaded: function(self,pos_mem_types){ 
            self.pos_mem_types = pos_mem_types; 
        },
    }]);

    var _super = models.Order;
    models.Order = models.Order.extend({
        initialize: function(attributes,options){
            _super.prototype.initialize.apply(this,arguments);
            if (options.json){
                this.loyalty_id = options.json.loyalty_id;
            } else {
                this.loyalty_id = undefined;
            }
        },
        init_from_JSON: function(json) {
            _super.prototype.init_from_JSON.apply(this,arguments);
            this.loyalty_id = json.loyalty_id;
        },
        export_as_JSON: function() {
            var res = _super.prototype.export_as_JSON.apply(this,arguments);
            //Added by GYB
            if (this.changed && _.has(this.changed, 'loyalty_id')){
                res.loyalty_id = this.changed.loyalty_id;
            }
            //Added by GYB-Done
            return res;
        },
        apply_reward: function(reward){
            var client = this.get_client();
            if (client && !client.reward_applicable) {
                this.pos.gui.show_popup('alert',{
                    'title': 'Not applicable Membership',
                    'body':  'Customer has not applicable for membership reward.',
                });
                return;
            } else {
                this.loyalty_id = reward.loyalty_program_id[0];
                return _super.prototype.apply_reward.apply(this,arguments);
            }
        },
        get_available_rewards: function(){
            if (this.pos.loyalty && this.pos.loyalty.rewards && this.pos.loyalty.rewards.length){
                return _super.prototype.get_available_rewards.apply(this,arguments);
            } else {
                return [];
            }
        }
    });
});
