odoo.define('pos_loyalty_fix.pos_loyalty', function (require) {
"use strict";

var models = require('point_of_sale.models');
var screens = require('point_of_sale.screens');
var core = require('web.core');
var utils = require('web.utils');

var round_pr = utils.round_precision;
var QWeb     = core.qweb;

models.load_fields('res.partner','loyalty_points');
models.load_models([
    {
        model: 'loyalty.program',
        condition: function(self){ return !!self.config.loyalty_id[0]; },
        fields: ['name','pp_currency','pp_product','pp_order','rounding', 'pos_mem_type_id', 'ic_join', 'ic_join_cost', 'ic_upg', 'ic_upg_cost'],
        domain: function(self){ return [['id','in',self.config.loyalty_id]] },
        loaded: function(self,loyalties){ 

            self.pos_loyalties = loyalties;
            self.loyalty = loyalties[0];
            self.loyalty_by_id = {};
            self.loyalty_by_membership_type = {};
            for (var i=0; i<loyalties.length; i++){
                self.loyalty_by_id[loyalties[i].id] = loyalties[i];
                loyalties[i].rules = [];
                loyalties[i].rules_by_product_id = {};
                loyalties[i].rules_by_category_id = {};
                loyalties[i].rewards = [];
                loyalties[i].rewards_by_id = {};
                self.loyalty_by_membership_type[loyalties[i].pos_mem_type_id[0]] = loyalties[i];
            }
        },
    },{
        model: 'loyalty.rule',
        condition: function(self){ return !!self.loyalty; },
        fields: ['loyalty_program_id', 'name','rule_type','product_id','category_id','cumulative','pp_product','pp_currency'],
        domain: function(self){ return [['loyalty_program_id','in',self.config.loyalty_id]]; },
        loaded: function(self, all_rules){
            var rules = []; 
            for (var i=0; i<all_rules.length; i++){
                if (all_rules[i].loyalty_program_id[0] == self.loyalty.id){
                    rules.push(all_rules[i]);
                }
            }

            self.loyalty.rules = rules; 
            self.loyalty.rules_by_product_id = {};
            self.loyalty.rules_by_category_id = {};

            for (var i = 0; i < rules.length; i++){
                var rule = rules[i];
                if (rule.rule_type === 'product') {
                    if (!self.loyalty.rules_by_product_id[rule.product_id[0]]) {
                        self.loyalty.rules_by_product_id[rule.product_id[0]] = [rule];
                    } else if (rule.cumulative) {
                        self.loyalty.rules_by_product_id[rule.product_id[0]].unshift(rule);
                    } else {
                        self.loyalty.rules_by_product_id[rule.product_id[0]].push(rule);
                    }
                } else if (rule.rule_type === 'category') {
                    var category = self.db.get_category_by_id(rule.category_id[0]);
                    if (!self.loyalty.rules_by_category_id[category.id]) {
                        self.loyalty.rules_by_category_id[category.id] = [rule];
                    } else if (rule.cumulative) {
                        self.loyalty.rules_by_category_id[category.id].unshift(rule);
                    } else {
                        self.loyalty.rules_by_category_id[category.id].push(rule);
                    }
                }
            }
            // ALL RULES WITH LOYALTY DEFINATION
            for (var i = 0; i < all_rules.length; i++){
                var rule = all_rules[i];
                var loyalty = self.loyalty_by_id[rule.loyalty_program_id[0]];
                loyalty.rules.push(rule);
                loyalty.rules_by_product_id = {};
                loyalty.rules_by_category_id = {};
                
                if (rule.rule_type === 'product') {
                    if (!loyalty.rules_by_product_id[rule.product_id[0]]) {
                        loyalty.rules_by_product_id[rule.product_id[0]] = [rule];
                    } else if (rule.cumulative) {
                        loyalty.rules_by_product_id[rule.product_id[0]].unshift(rule);
                    } else {
                        loyalty.rules_by_product_id[rule.product_id[0]].push(rule);
                    }
                } else if (rule.rule_type === 'category') {
                    var category = self.db.get_category_by_id(rule.category_id[0]);
                    if (!loyalty.rules_by_category_id[category.id]) {
                        loyalty.rules_by_category_id[category.id] = [rule];
                    } else if (rule.cumulative) {
                        loyalty.rules_by_category_id[category.id].unshift(rule);
                    } else {
                        loyalty.rules_by_category_id[category.id].push(rule);
                    }
                }
            }
        },
    },{
        model: 'loyalty.reward',
        condition: function(self){ return !!self.loyalty; },
        fields: ['name','loyalty_program_id','reward_type','minimum_points','gift_product_id','point_cost','discount_product_id','discount','point_product_id'],
        domain: function(self){ return [['loyalty_program_id','in',self.config.loyalty_id]]; },
        loaded: function(self, all_rewards){
            var rewards = []; 
            for (var i=0; i<all_rewards.length; i++){
                if (all_rewards[i].loyalty_program_id[0] == self.loyalty.id){
                    rewards.push(all_rewards[i]);
                }
            }
            self.loyalty.rewards = rewards; 
            self.loyalty.rewards_by_id = {};
            for (var i = 0; i < rewards.length;i++) {
                self.loyalty.rewards_by_id[rewards[i].id] = rewards[i];
            }

            // ALL REWARD WITH LOYALTY DEFINATION
            for (var i = 0; i < all_rewards.length; i++){
                var reward = all_rewards[i];
                var loyalty = self.loyalty_by_id[reward.loyalty_program_id[0]];
                var reward_added_in_loyalty = false;
                for (var j=0; j<loyalty.rewards.length; j++){
                    if (loyalty.rewards[j].id == reward.id){
                        reward_added_in_loyalty = true;
                    }
                }
                if(!reward_added_in_loyalty){
                    loyalty.rewards.push(reward);
                }
                loyalty.rewards_by_id[reward.id] = reward;
            }
        },
    },
],{'after': 'product.product'});


screens.OrderWidget.include({
    update_summary: function(){
        var order = this.pos.get_order();
        if (order.get_client()){
            var customer = order.get_client();
            if (customer.loyalty_id && customer.loyalty_id[0] && this.pos.loyalty){
                // var loyalty = this.pos.loyalty_by_membership_type[customer.mem_type[0]];
                var loyalty = this.pos.loyalty_by_id[customer.loyalty_id[0]];
                if (loyalty){
                    this.pos.loyalty = loyalty;
                    order.loyalty_id = customer.loyalty_id[0];
                } else {
                    this.pos.loyalty = undefined;
                    order.loyalty_id = undefined;
                }
            } else {
                this.pos.loyalty = undefined;
                order.loyalty_id = undefined;
            }
        }
        this._super();
    },
});

});
