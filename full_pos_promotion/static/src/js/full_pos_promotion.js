odoo.define('full_pos_promotion.full_pos_promotion', function (require) {
"use strict";
    /*once promo will be stackable only other promo with stackable true will be apply*/
    var models = require('point_of_sale.models');
    var Model   = require('web.Model');
    var core    = require('web.core');
    var gui     = require('point_of_sale.gui');
    var _t      = core._t;
	var popups  = require('point_of_sale.popups');
    var pos_model = require('point_of_sale.models');
    var PopupWidget = require('point_of_sale.popups');
    var screens = require('point_of_sale.screens');
    var QWeb = core.qweb;
    var PosDB = require('point_of_sale.DB');
    var PaymentScreenWidget = screens.PaymentScreenWidget;
    var utils = require('web.utils');
    var round_pr = utils.round_precision;

    models.load_fields('product.product',['product_brand_id']);
    models.load_fields('res.users',['promotion_pin']);
    models.load_models([
      {
            model: 'res.branch',
            fields: [],
            domain: function (self) {
                return [['id', '=', self.config.branch_id[0]]]
            },
            context: {'pos': true},
            loaded: function (self, branch) {
                self.branch = branch;
                self.branch_by_id = {};
                self.branch_ids = [];
                var i = 0;
                while (i < branch.length) {
                    self.branch_by_id[branch[i].id] = branch[i];
                    self.branch_ids.push(branch[i].id);
                    i++;
                }
            }
      },
      {
            model: 'pos.promotion',
            fields: [],
            domain: function (self) {
                return [['id', 'in', self.config.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, promotions) {
                self.promotions = promotions;
                self.promotion_by_id = {};
                self.promotion_ids = []
                var i = 0;
                while (i < promotions.length) {
                    self.promotion_by_id[promotions[i].id] = promotions[i];
                    self.promotion_ids.push(promotions[i].id);
                    i++;
                }
            }
      },
      {
            model: 'pos.brand.discount.condition',
            fields: [],
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, brand_gift_conditions) {
                self.promotion_brand_gift_condition_by_promotion_id = {};
                var i = 0;
                while (i < brand_gift_conditions.length) {
                    if (!self.promotion_brand_gift_condition_by_promotion_id[brand_gift_conditions[i].promotion_id[0]]) {
                        self.promotion_brand_gift_condition_by_promotion_id[brand_gift_conditions[i].promotion_id[0]] = [brand_gift_conditions[i]]
                    } else {
                        self.promotion_brand_gift_condition_by_promotion_id[brand_gift_conditions[i].promotion_id[0]].push(brand_gift_conditions[i])
                    }
                    i++;
                }
            }
       },

       {
            model: 'pos.product.product.condition',
            fields: [],
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, product_gift_conditions) {
                self.promotion_product_gift_condition_by_promotion_id = {};
                var i = 0;
                while (i < product_gift_conditions.length) {
                    if (!self.promotion_product_gift_condition_by_promotion_id[product_gift_conditions[i].promotion_id[0]]) {
                        self.promotion_product_gift_condition_by_promotion_id[product_gift_conditions[i].promotion_id[0]] = [product_gift_conditions[i]]
                    } else {
                        self.promotion_product_gift_condition_by_promotion_id[product_gift_conditions[i].promotion_id[0]].push(product_gift_conditions[i])
                    }
                    i++;
                }
            }
        },
        {
            model: 'pos.product.product.free',
            fields: [],
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, product_gift_free) {
                self.promotion_product_gift_free_by_promotion_id = {};
                var i = 0;
                while (i < product_gift_free.length) {
                    if (!self.promotion_product_gift_free_by_promotion_id[product_gift_free[i].promotion_id[0]]) {
                        self.promotion_product_gift_free_by_promotion_id[product_gift_free[i].promotion_id[0]] = [product_gift_free[i]]
                    } else {
                        self.promotion_product_gift_free_by_promotion_id[product_gift_free[i].promotion_id[0]].push(product_gift_free[i])
                    }
                    i++;
                }
            }
        },
        // New model added for type = Free x from group of products
        {
            model: 'pos.group.of.products',
            fields: [],
            domain: function (self) {
                return [['promotion_id', 'in', self.promotion_ids]]
            },
            context: {'pos': true},
            loaded: function (self, free_gift_based_on_group_of_product) {
                self.promotion_free_gift_based_on_group_of_product_by_promotion_id = {};
                var i = 0;
                while (i < free_gift_based_on_group_of_product.length) {
                    if (!self.promotion_free_gift_based_on_group_of_product_by_promotion_id[free_gift_based_on_group_of_product[i].promotion_id[0]]) {
                        self.promotion_free_gift_based_on_group_of_product_by_promotion_id[free_gift_based_on_group_of_product[i].promotion_id[0]] = [free_gift_based_on_group_of_product[i]]
                    } else {
                        self.promotion_free_gift_based_on_group_of_product_by_promotion_id[free_gift_based_on_group_of_product[i].promotion_id[0]].push(free_gift_based_on_group_of_product[i])
                    }
                    i++;
                }
            }
        },
        {
			model: 'pos.promotion.days',
			fields: ['id', 'name'],
			loaded: function(self, days) {
			    self.db.pos_promotion_days_by_id = {};
                for (var index in days){
				    self.db.pos_promotion_days_by_id[days[index].id.toString()] = days[index];
                }
			},
	    },
    ]);

	screens.OrderWidget.include({
		rerender_orderline: function(order_line){
			if (!order_line.promotion && order_line.promotion == false) {
				order_line.order.disc_tot = false; //t1
				this.pos.promotion_apply_disc_tot = false; //t1

		        order_line.order.disc_cat = false; //t2
				this.pos.promotion_apply_disc_cat = false; //t2

		        order_line.order.disc_qty = false; //t3
				this.pos.promotion_apply_disc_qty = false; //t3

		        order_line.order.pp_disc = false; //t4
				this.pos.promotion_apply_disc_prod = false; //t4

		        order_line.order.pp_free = false; //t5
				this.pos.promotion_apply_free_prod = false; //t5

		        order_line.order.ppf_qty = false; //t6
				this.pos.promotion_apply_filter = false; //t6

		        order_line.order.by_brand = false; //t7
				this.pos.promotion_apply = false; //t7

				order_line.order.by_pro_free = false; //t8
				this.pos.promotion_apply_9 = false; //t8

		        order_line.order.by_free_x = false; //t9
				this.pos.promotion_apply_10 = false; //t9
			}
		    var node = order_line.node;
		    var replacement_line = this.render_orderline(order_line);
		    node.parentNode.replaceChild(replacement_line,node);
		},
	});


    var _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        initialize: function (attributes, options) {
            var self = this;
            var res = _super_order.initialize.apply(this, arguments);
            this.disc_tot = false; //type 1
            this.disc_cat = false; //type 2
            this.disc_qty = false; //type 3
            this.pp_disc = false; //type 4
            this.pp_free = false; //type 5
            this.ppf_qty = false; //type 6
            this.by_brand = false; //type 7
			this.by_pro_free = false; //type 8
            this.by_free_x = false; //type 9

            this.pr_st = false;
            this.old_promo = false;
            setInterval(function () {
                if (self.pos.auto_promotion_new && self.pos.auto_promotion_new == true) {
					if (self.finalized == false) {
                    	self.auto_build_promotion_new();
					}
                }
            }, 1000);
            return res;
        },
        /*Overrided  from Core > pos_promotion*/
        get_total_without_promotion_and_tax: function () {
            var rounding = this.pos.currency.rounding;
            var orderlines = this.orderlines.models
            var sum = 0
            var i = 0
            while (i < orderlines.length) {
                var line = orderlines[i];
                if (line.promotion && line.promotion == true) {
                    i++;
                    continue
                }
                sum += round_pr(line.get_unit_price() * line.get_quantity() * (1 - line.get_discount() / 100), rounding)
                i++
            }
            return sum;
        },
        promo_check_in_days: function (array_ids) {
            var self = this;
            var d = new Date();
            var weekday = new Array(7);
            weekday[0] = "Sunday";
            weekday[1] = "Monday";
            weekday[2] = "Tuesday";
            weekday[3] = "Wednesday";
            weekday[4] = "Thursday";
            weekday[5] = "Friday";
            weekday[6] = "Saturday";
            var result = false;
            var day = weekday[d.getDay()];
            array_ids.forEach(function (item) {
                if(self.pos.db.pos_promotion_days_by_id[item] && self.pos.db.pos_promotion_days_by_id[item].name == day){
                    result = true;
                }
            });
            return result
        },
        promo_check_in_hours: function (string) {
            var period = string.split(',');
            var result = false;
            period.forEach(function (item) {
                var hours = item.trim().split('-');
                var current_hour = new Date().getHours();
                if(parseInt(hours[0]) <= current_hour <= parseInt(hours[1])){
                    result = true;
                }
            });
            return result;
        },
        //overrided from core module for auto promotion
        auto_build_promotion_new: function () {
            if (!this.pos.building_promotion || this.pos.building_promotion == false) {
                if (this.pos.config.allow_promotion == true && this.pos.config.promotion_ids.length) {
                    this.pos.building_promotion = true;
                    var self = this;
                    self.promotions = [];
                    this.pos.promotions.forEach(function (item) {
                        if(item.start_date){
                            if(item.start_date)var start_time = new Date(item.start_date).getTime();
                            if(item.end_date)var end_time = new Date(item.end_date).getTime();
                            var current_time = new Date().getTime();
                            if(!item.start_date || start_time < current_time){
                                if (!item.end_date || current_time < end_time){
                                    if(item.week_days_ids.length == 0 || self.promo_check_in_days(item.week_days_ids)){
                                        if(!item.hours || self.promo_check_in_hours(item.hours)){
                                            self.promotions.push(item);
                                        }
                                    }
                                }
                            }
                        }
                    });

                    var lines = this.orderlines.models
                    var applied_promo = {}
                    
                    for (var m=0; m < lines.length; m++){
                        if (lines[m].promos){
                            this.pr_st = true;
                            this.old_promo = false;
                            if(lines[m].promos.stackable_in_promotion == true){
                                this.old_promo = lines[m].promos.stackable_in_promotion
                            }
                        }
                    }
                    if (self.promotions) {
                        var promotions_sorted = _.sortBy(self.promotions, 'prior_seq_no').reverse();
                        var disc_t = false; //1
                        var disc_c = false; //2
                        var disc_q = false; //3
                        var disc_pt = false; //4
                        var free_pt = false; //5
                        var filter_q = false; //6
                        var free = false;
                        var brand = false;
                        var free_x = false;
                        for (var i = 0; i < promotions_sorted.length; i++) {
                            var type = promotions_sorted[i].type
                            var order = this;
                            if (order.orderlines.length) {
                                if (type == '1_discount_total_order' && disc_c == false && disc_q == false
                                    && disc_pt == false && free_pt == false && filter_q == false && free == false
                                    && brand == false && free_x == false) {
                                        if ((this.pos.promotion_apply_disc_tot == false || !this.pos.promotion_apply_disc_tot) &&   ($("#free").is(":visible") == false)) {
											if(this.disc_tot == false){
	                                            disc_t = true;
	                                            order.compute_discount_total_order_fpp(promotions_sorted[i]);
											}
                                    }
                                }
                                if (type == '2_discount_category' && disc_t == false && disc_q == false
                                    && disc_pt == false && free_pt == false && filter_q == false && free == false
                                    && brand == false && free_x == false) {
                                        if ((this.pos.promotion_apply_disc_cat == false || !this.pos.promotion_apply_disc_cat) &&   ($("#free").is(":visible") == false)) {
											if(this.disc_cat == false){                                            
												disc_c = true;
		                                        order.compute_discount_category_fpp(promotions_sorted[i]);
											}
                                        }
                                }
                                if (type == '3_discount_by_quantity_of_product' && disc_t == false && disc_c == false
                                    && disc_pt == false && free_pt == false && filter_q == false && free == false
                                    && brand == false && free_x == false) {
                                        if ((this.pos.promotion_apply_disc_qty == false || !this.pos.promotion_apply_disc_qty) &&  ($("#free").is(":visible") == false)) {
											if(this.disc_qty == false){
		                                        disc_q = true;
		                                        order.compute_discount_by_quantity_of_products_fpp(promotions_sorted[i]);
											}
                                        }
                                }

                                if (type == '4_pack_discount' && disc_t == false && disc_c == false
                                    && disc_q == false && free_pt == false && filter_q == false && free == false
                                    && brand == false && free_x == false) {
                                        if ((this.pos.promotion_apply_disc_prod == false || !this.pos.promotion_apply_disc_prod) &&  ($("#free").is(":visible") == false)) {
											if(this.pp_disc == false){
		                                        disc_pt = true;
		                                        order.compute_pack_discount_fpp(promotions_sorted[i]);
											}
                                    }
                                }
                                if (type == '5_pack_free_gift' && disc_t == false && disc_c == false
                                    && disc_pt == false && disc_q == false && filter_q == false && free == false
                                    && brand == false && free_x == false) {
                                        if ((this.pos.promotion_apply_free_prod == false || !this.pos.promotion_apply_free_prod) &&  ($("#free").is(":visible") == false)) {
											if(this.pp_free == false){
		                                        free_pt = true;
		                                        order.compute_pack_free_gift_fpp(promotions_sorted[i]);
											}
                                    }
                                }
                                if (type == '6_price_filter_quantity' && disc_t == false && disc_c == false
                                    && disc_pt == false && disc_q == false && free_pt == false && free == false
                                    && brand == false && free_x == false) {
                                        if ((this.pos.promotion_apply_filter == false || !this.pos.promotion_apply_filter) &&  ($("#free").is(":visible") == false)) {
											if(this.ppf_qty == false){
	                                            filter_q = true;
	                                            order.compute_price_filter_quantity_fpp(promotions_sorted[i]);
											}
                                    }
                                }
                                if (type == '8_brand_product_pos' && disc_t == false && disc_c == false
                                    && disc_pt == false && disc_q == false && free_pt == false && free == false
                                    && filter_q == false && free_x == false) {
                                        if ((this.pos.promotion_apply == false || !this.pos.promotion_apply) && ($("#free").is(":visible") == false)) {                                        
											if (this.by_brand == false){
	                                            brand = true;
	                                            order.compute_brand_product_pos(promotions_sorted[i]);
											}
                                    }
                                }
                                if (type == '9_product_product_pos' && disc_t == false && disc_c == false
                                    && disc_pt == false && disc_q == false && free_pt == false && brand == false
                                    && filter_q == false && free_x == false) {
                                        if ((this.pos.promotion_apply_9 == false || !this.pos.promotion_apply_9) && ($("#free").is(":visible") == false)) {
                                            if (this.by_pro_free == false){
												free = true;
	                                            order.compute_product_product_pos(promotions_sorted[i]);
											}
                                        }
                                }
                                if (type == '10_free_x_from_group_of_product' && disc_t == false && disc_c == false
                                    && disc_pt == false && disc_q == false && free_pt == false && brand == false
                                    && filter_q == false && free == false) {
                                        if ((this.pos.promotion_apply_10 == false || !this.pos.promotion_apply_10) &&  ($("#flexi").is(":visible") == false)) {
											if (this.by_free_x == false){
		                                        free_x = true;                                              
		                                        order.compute_free_x_from_group_of_products(promotions_sorted[i]);
											}
                                    }
                                }
                            }
                        }
                    }
                    this.pos.building_promotion = false;
                }
            }
        },
        
        get_product_and_quantity_current_order_fpp: function () {
            var lines_list = {};
            var lines = this.orderlines.models;
            var i = 0;
            while (i < lines.length) {
                var line = lines[i];
                if (line.promotion) {
                    i++;
                    continue
                }
                if (!lines_list[line.product.id]) {
                    lines_list[line.product.id] = line.quantity;
                } else {
                    lines_list[line.product.id] += line.quantity;
                }
                i++;
            }
            return lines_list
        },
        checking_can_apply_promotion_fpp: function (promotion_condition_items) {
            var check = true;
            var quantity_item_by_product_id = {};
            var lines = this.orderlines.models;
            /*var pro_brand_id = promotion.brand_id[0]; //Updated Based ON many2one
            var max_disc = promotion.max_disc_amt;
            var min_amt = promotion.min_amt;
            var discount = 0;*/
            for (i in promotion_condition_items) {
                var item = promotion_condition_items[i];
                if (!quantity_item_by_product_id[item.product_id[0]]) {
                    quantity_item_by_product_id[item.product_id[0]] = item.quantity_free
                } else {
                    quantity_item_by_product_id[item.product_id[0]] += item.quantity_free
                }
            }
            var quantity_line_by_product_id = this.get_product_and_quantity_current_order_fpp();
            if (!quantity_line_by_product_id || !promotion_condition_items) {
                return false
            }
            for (i in promotion_condition_items) {
                if (!quantity_line_by_product_id[promotion_condition_items[i].product_id[0]]) {
                    check = false;
                    continue
                }
                if (quantity_line_by_product_id[promotion_condition_items[i].product_id[0]] < quantity_item_by_product_id[promotion_condition_items[i].product_id[0]]) {
                    check = false;
                    continue
                }
            }
            return check
        },
        check_apply_total_order: function (promotion) {
            var discount_lines = this.pos.promotion_discount_order_by_promotion_id[promotion.id];
            var total_order = this.get_total_without_promotion_and_tax();
            var lines = this.orderlines.models;
            var discount_line_tmp = null;
            var discount_tmp = 0;
            var pro_brand_id = promotion.brand_id[0];
            var count = 0;
            var z = 0;
            var brnd_app = false;
            while (z < lines.length){
                if (pro_brand_id && pro_brand_id == lines[z].product.product_brand_id[0]) {
                    count += 1;
                }
                z++;
            }
            if (count == lines.length){
                brnd_app = true;
            }
            if (pro_brand_id && brnd_app){
                if (discount_lines) {
                    var i = 0;
                    while (i < discount_lines.length) {
                        var discount_line = discount_lines[i];
                        if (total_order >= discount_line.minimum_amount && total_order >= discount_tmp) {
                            discount_line_tmp = discount_line;
                            discount_tmp = discount_line.minimum_amount
                        }
                        i++;
                    }
                }
            }
            if (!pro_brand_id){
                if (discount_lines) {
                    var i = 0;
                    while (i < discount_lines.length) {
                        var discount_line = discount_lines[i];
                        if (total_order >= discount_line.minimum_amount && total_order >= discount_tmp) {
                            discount_line_tmp = discount_line;
                            discount_tmp = discount_line.minimum_amount
                        }
                        i++;
                    }
                }
            }
            return discount_line_tmp;
        },
        /*For Type 1 = Discount on total order */
        // minimal amount is not required here as amount total greater or equal condition in discount line
        // if promotion has set 1 brand and ORDER has 6 lines than anyone has same brand than only those lines total should consider for apply promotion?
        compute_discount_total_order_fpp: function (promotion) {
            var discount_line_tmp = this.check_apply_total_order(promotion)
            var total_order = this.get_total_without_promotion_and_tax();
            var max_disc = promotion.max_disc_amt;
            var discount = 0;
            /*start code from here*/
            var lines = this.orderlines.models;
            var lines_remove = [];
            var i = 0;
            var applied_promo = [];
            var l = 0;
            while (l < lines.length) {
                var line = lines[l];
                if (line.promos){
                    applied_promo.push(line);
                }
                l++;
            }
            var another_promo = false;
            for (var m=0; m < applied_promo.length; m++){
                another_promo = applied_promo[m].promos.stackable_in_promotion;
            }
            while (i < lines.length) {
                var line = lines[i];
                if ((line.promotion_discount_total_order && line.promotion_discount_total_order == true)//type1
                || (line.promotion_discount_category && line.promotion_discount_category == true)//type2
                || (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true)//type3
                || (line.promotion_discount && line.promotion_discount == true)//type4
                || (line.promotion_gift && line.promotion_gift == true)//type5
                || (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true)//type6
                || (line.promotion_brand_gift_condition && line.promotion_brand_gift_condition == true)//type 7
                || (line.promotion_product_gift_condition && line.promotion_product_gift_condition == true)//type 8
                || (line.free_gift_based_on_group_of_product && line.free_gift_based_on_group_of_product == true)//type 09
                ){
                    lines_remove.push(line)
                }
                i++;
            }
            if (another_promo == false && this.pos.auto_promotion_new == false){
                this.remove_promotion_lines(lines_remove);
                this.pos.promotion_apply_disc_tot = false; // type 1
                this.pos.promotion_apply_disc_cat = false; // type 2
                this.pos.promotion_apply_disc_qty = false; // type 3
                this.pos.promotion_apply_disc_prod = false; // type 4
                this.pos.promotion_apply_free_prod = false; // type 5
                this.pos.promotion_apply_filter = false;//type 6
                this.pos.promotion_apply = false;
                this.pos.promotion_apply_9 = false;
                this.pos.promotion_apply_10 = false;
            }
            /*END*/
            /*code for auto promotion*/
            if(this.pos.auto_promotion_new == true){
                if (this.pr_st && this.old_promo == false){
                    return false;
                } else {
                    var stackable = false;
                    if (this.old_promo && promotion.stackable_in_promotion){
                        stackable = true;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion) {
                        stackable = true;
                    } else if(this.old_promo && promotion.stackable_in_promotion == false) {
                        stackable = false;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion == false) {
                        stackable = true;
                    }
                    if (discount_line_tmp && !this.pos.promotion_apply_disc_tot && stackable == true) {
                        var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
                        if (product) {

							/* update realtime promotion for type 1*/
							for (var m=0; m < applied_promo.length; m++){
								if (applied_promo[m].promos.type == promotion.type) {
									this.remove_promotion_lines([applied_promo[m]]);
									break;
								}
							}

                            /*if (promotion.discount_type == 'percent'){
                                this.add_product(product, {
                                    price: -total_order / 100 * discount_line_tmp.discount
                                })
                            }
                            else{
                                this.add_product(product, {
                                    price: -discount_line_tmp.discount
                                })
                            }*/
                            if (promotion.discount_type == 'percent'){
                                if (max_disc > 0 && ((total_order / 100 * discount_line_tmp.discount) > max_disc)){
                                    discount = max_disc;
                                } else {
                                    discount = total_order / 100 * discount_line_tmp.discount
                                }
                                this.add_product(product, {
                                    price: -discount
                                })
                            }
                            else{
                                if (max_disc > 0 && (discount_line_tmp.discount) > max_disc) {
                                    discount = max_disc;
                                } else {
                                    discount = discount_line_tmp.discount
                                }
                                this.add_product(product, {
                                    price: -discount
                                })
                            }
                            this.pos.promotion_apply_disc_tot = true; // type 1
                            var selected_line = this.get_selected_orderline();
                            selected_line.promotion_discount_total_order = true;
                            selected_line.promotion = true;
                            selected_line.promos = promotion;
                            this.disc_tot = false; 
                            /*if (promotion.discount_type == 'percent'){
                                selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + ' % ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
                            }else{
                                selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + '   ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
                            }*/
                            if (promotion.discount_type == 'percent' && (total_order / 100 * discount_line_tmp.discount) <= max_disc){
                                selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + ' % ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
                            } else if (promotion.discount_type == 'percent' && max_disc > 0 && (total_order / 100 * discount_line_tmp.discount) > max_disc){
                                selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + ' % ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
                            } else if (promotion.discount_type == 'amount' && max_disc > 0 && discount_line_tmp.discount > max_disc){
                                selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + '   ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
                            } else{
                                selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + '   ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
                            }
                            selected_line.trigger('change', selected_line);
                        }
                    } else {
                        this.disc_tot = true;
                    }

                }
            }
            /*for manual promotion*/
            if(this.pos.auto_promotion_new == false){
                if (discount_line_tmp && !this.pos.promotion_apply_disc_tot) {
                    var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
                    if (product) {
                        /*if (promotion.discount_type == 'percent'){
                            this.add_product(product, {
                                price: -total_order / 100 * discount_line_tmp.discount
                            })
                        }
                        else{
                            this.add_product(product, {
                                price: -discount_line_tmp.discount
                            })
                        }*/
                        if (promotion.discount_type == 'percent'){
                            if (max_disc > 0 && ((total_order / 100 * discount_line_tmp.discount) > max_disc)) {
                                discount = max_disc;
                            } else {
                                discount = total_order / 100 * discount_line_tmp.discount
                            }
                            this.add_product(product, {
                                price: -discount
                            })
                        }
                        else{
                            if (max_disc > 0 && (discount_line_tmp.discount) > max_disc) {
                                discount = max_disc;
                            } else {
                                discount = discount_line_tmp.discount
                            }
                            this.add_product(product, {
                                price: -discount
                            })
                        }
                        this.pos.promotion_apply_disc_tot = true; // type 1
                        var selected_line = this.get_selected_orderline();
                        selected_line.promotion_discount_total_order = true;
                        selected_line.promotion = true;
                        selected_line.promos = promotion;
                        this.disc_tot = false;
                        /*if (promotion.discount_type == 'percent'){
                            selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + ' % ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
                        }else{
                            selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + '   ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
                        }*/
                        if (promotion.discount_type == 'percent' && (total_order / 100 * discount_line_tmp.discount) <= max_disc){
	                        selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + ' % ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
	                    } else if (promotion.discount_type == 'percent' && max_disc > 0 && (total_order / 100 * discount_line_tmp.discount) > max_disc){
	                        selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + ' % ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
	                    } else if (promotion.discount_type == 'amount' && max_disc > 0 && discount_line_tmp.discount > max_disc){
	                        selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + '   ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
	                    } else{
	                        selected_line.promotion_reason = ' discount ' + discount_line_tmp.discount + '   ' + ' when total order greater or equal ' + discount_line_tmp.minimum_amount;
	                    }
                        selected_line.trigger('change', selected_line);
                    }
                }
            }
        },
        /*For Type 2 = Discount on categories*/
        compute_discount_category_fpp: function (promotion) {
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            if (!product || !this.pos.promotion_by_category_id) {
                return;
            }
            //var pro_brand_id = promotion.brand_ids[0];
            var pro_brand_id = promotion.brand_id[0]; //Updated Based ON many2one
            var max_disc = promotion.max_disc_amt;
            var min_amt = promotion.min_amt;
            var discount = 0;
            /*start code from here*/
            var lines = this.orderlines.models;
            var lines_remove = [];
            var i = 0;
            var applied_promo = [];
            var l = 0;
            while (l < lines.length) {
                var line = lines[l];
                if (line.promos){
                    applied_promo.push(line);
                }
                l++;
            }
            var another_promo = false;
            for (var m=0; m < applied_promo.length; m++){
                another_promo = applied_promo[m].promos.stackable_in_promotion;
            }
            while (i < lines.length) {
                var line = lines[i];
                if ((line.promotion_discount_total_order && line.promotion_discount_total_order == true)//type1
                || (line.promotion_discount_category && line.promotion_discount_category == true)//type2
                || (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true)//type3
                || (line.promotion_discount && line.promotion_discount == true)//type4
                || (line.promotion_gift && line.promotion_gift == true)//type5
                || (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true)//type6
                || (line.promotion_brand_gift_condition && line.promotion_brand_gift_condition == true)//type 7
                || (line.promotion_product_gift_condition && line.promotion_product_gift_condition == true)//type 8
                || (line.free_gift_based_on_group_of_product && line.free_gift_based_on_group_of_product == true)//type 09
                ){
                    lines_remove.push(line)
                }
                i++;
            }
            if (another_promo == false && this.pos.auto_promotion_new == false){
                this.remove_promotion_lines(lines_remove);
                this.pos.promotion_apply_disc_tot = false; // type 1
                this.pos.promotion_apply_disc_cat = false; // type 2
                this.pos.promotion_apply_disc_qty = false; // type 3
                this.pos.promotion_apply_disc_prod = false; // type 4
                this.pos.promotion_apply_free_prod = false; // type 5
                this.pos.promotion_apply_filter = false;//type 6
                this.pos.promotion_apply = false;
                this.pos.promotion_apply_9 = false;
                this.pos.promotion_apply_10 = false;
            }
            /*END*/
            /*code for auto promotion*/
            if(this.pos.auto_promotion_new == true){
                if (this.pr_st && this.old_promo == false){
                    return false;
                } else {
                    var stackable = false;
                    if (this.old_promo && promotion.stackable_in_promotion){
                        stackable = true;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion) {
                        stackable = true;
                    } else if(this.old_promo && promotion.stackable_in_promotion == false) {
                        stackable = false;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion == false) {
                        stackable = true;
                    }
                    for (i in this.pos.promotion_by_category_id) {
                        var promotion_line = this.pos.promotion_by_category_id[i];
                        var amount_total_by_category = 0;
                        var z = 0;
                        while (z < lines.length) {
                            if (!lines[z].product.pos_categ_id) {
                                z++;
                                continue;
                            }
                            if (pro_brand_id && pro_brand_id == lines[z].product.product_brand_id[0]) {
                                if (lines[z].product.pos_categ_id[0] == promotion_line.category_id[0]) {
                                    amount_total_by_category += lines[z].get_price_without_tax();
                                }
                            }
                            if (!pro_brand_id){
                                if (lines[z].product.pos_categ_id[0] == promotion_line.category_id[0]) {
                                    amount_total_by_category += lines[z].get_price_without_tax();
                                }
                            }
                            z++;
                        }

                        if (amount_total_by_category !=0 && amount_total_by_category >= min_amt && !this.pos.promotion_apply_disc_cat && stackable == true) {
							/* update realtime promotion for type 2*/
							for (var m=0; m < applied_promo.length; m++){
								if (applied_promo[m].promos.type == promotion.type) {
									this.remove_promotion_lines([applied_promo[m]]);
									break;
								}
							}
							if (promotion.discount_type == 'percent'){
                                if (max_disc > 0 && ((amount_total_by_category / 100 * promotion_line.discount) > max_disc)) {
                                    discount = max_disc;
                                } else {
                                    discount = amount_total_by_category / 100 * promotion_line.discount
                                }
		                        this.add_product(product, {
		                            price: -discount
		                        })
		                    }
		                    else{
                                if (max_disc > 0 && (promotion_line.discount) > max_disc) {
                                    discount = max_disc;
                                } else {
                                    discount = promotion_line.discount
                                }
		                        this.add_product(product, {
		                            price: -discount
		                        })
		                    }
                            this.pos.promotion_apply_disc_cat = true; // type 2
                            var selected_line = this.get_selected_orderline();
                            selected_line.promotion_discount_category = true;
                            selected_line.promotion = true;
                            selected_line.promos = promotion;
                            this.disc_cat = false;
							if (promotion.discount_type == 'percent' && (amount_total_by_category / 100 * promotion_line.discount) <= max_disc){
	                            selected_line.promotion_reason = ' discount ' + promotion_line.discount + ' % ' + promotion_line.category_id[1];
	                        } else if (promotion.discount_type == 'percent' && max_disc > 0 && (amount_total_by_category / 100 * promotion_line.discount) > max_disc){
	                            selected_line.promotion_reason = ' discount ' + max_disc  + ' ' + promotion_line.category_id[1];
	                        } else if (promotion.discount_type == 'amount' && max_disc > 0 && promotion_line.discount > max_disc){
	                            selected_line.promotion_reason = ' discount ' + max_disc + ' ' + promotion_line.category_id[1];
	                        } else{
	                            selected_line.promotion_reason = ' discount ' + promotion_line.discount + '   ' + promotion_line.category_id[1];
	                        }
                            selected_line.trigger('change', selected_line);
                        } else {
							this.disc_cat = true;
						}
						
						i++;
                    }

                }
            }
            if(this.pos.auto_promotion_new == false){
                for (i in this.pos.promotion_by_category_id) {
                    var promotion_line = this.pos.promotion_by_category_id[i];
                    var amount_total_by_category = 0;
                    var z = 0;
                    while (z < lines.length) {
                        if (!lines[z].product.pos_categ_id) {
                            z++;
                            continue;
                        }
                        if (pro_brand_id && pro_brand_id == lines[z].product.product_brand_id[0]) {
                            if (lines[z].product.pos_categ_id[0] == promotion_line.category_id[0]) {
                                amount_total_by_category += lines[z].get_price_without_tax();
                            }
                        }
                        if (!pro_brand_id){
                            if (lines[z].product.pos_categ_id[0] == promotion_line.category_id[0]) {
                                amount_total_by_category += lines[z].get_price_without_tax();
                            }
                        }
                        z++;
                    }
                    if (amount_total_by_category !=0 && amount_total_by_category >= min_amt && promotion_line.discount && !this.pos.promotion_apply_disc_cat) {
						if (promotion.discount_type == 'percent'){
                            if (max_disc > 0 && ((amount_total_by_category / 100 * promotion_line.discount) > max_disc)) {
                                discount = max_disc;
                            } else {
                                discount = amount_total_by_category / 100 * promotion_line.discount
                            }
                            this.add_product(product, {
                                price: -discount
                            })
                        }
                        else{
                            if (max_disc > 0 && (promotion_line.discount) > max_disc) {
                                discount = max_disc;
                            } else {
                                discount = promotion_line.discount
                            }
                            this.add_product(product, {
                                price: -discount
                            })
                        }
                        this.pos.promotion_apply_disc_cat = true; // type 2
                        var selected_line = this.get_selected_orderline();
                        selected_line.promotion_discount_category = true;
                        selected_line.promotion = true;
                        selected_line.promos = promotion;
                        this.disc_cat = false;
                        if (promotion.discount_type == 'percent' && (amount_total_by_category / 100 * promotion_line.discount) <= max_disc){
	                        selected_line.promotion_reason = ' discount ' + promotion_line.discount + ' % ' + promotion_line.category_id[1];
	                    } else if (promotion.discount_type == 'percent' && max_disc > 0 && (amount_total_by_category / 100 * promotion_line.discount) > max_disc){
	                        selected_line.promotion_reason = ' discount ' + max_disc  + ' ' + promotion_line.category_id[1];
	                    } else if (promotion.discount_type == 'amount' && max_disc > 0 && promotion_line.discount > max_disc){
	                        selected_line.promotion_reason = ' discount ' + max_disc + ' ' + promotion_line.category_id[1];
	                    } else{
	                        selected_line.promotion_reason = ' discount ' + promotion_line.discount + '   ' + promotion_line.category_id[1];
	                    }
						selected_line.trigger('change', selected_line);
                    }
					i++;
                }
             }
        },
        /*For Type 3 = Discount by quantity of product*/
        compute_discount_by_quantity_of_products_fpp: function (promotion) {
            var quantity_by_product_id = {}
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var pro_brand_id = promotion.brand_id[0]; //Updated Based ON many2one
            var max_disc = promotion.max_disc_amt;
            var min_amt = promotion.min_amt;
            var discount = 0;
            var i = 0;
            var lines = this.orderlines.models;
            var lines_remove = [];
            var i = 0;
            var applied_promo = [];
            var l = 0;
            while (l < lines.length) {
                var line = lines[l];
                if (line.promos){
                    applied_promo.push(line);
                }
                l++;
            }
            var another_promo = false;
            for (var m=0; m < applied_promo.length; m++){
                another_promo = applied_promo[m].promos.stackable_in_promotion;
            }
            while (i < lines.length) {
                var line = lines[i];
                if ((line.promotion_discount_total_order && line.promotion_discount_total_order == true)//type1
                || (line.promotion_discount_category && line.promotion_discount_category == true)//type2
                || (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true)//type3
                || (line.promotion_discount && line.promotion_discount == true)//type4
                || (line.promotion_gift && line.promotion_gift == true)//type5
                || (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true)//type6
                || (line.promotion_brand_gift_condition && line.promotion_brand_gift_condition == true)//type 7
                || (line.promotion_product_gift_condition && line.promotion_product_gift_condition == true)//type 8
                || (line.free_gift_based_on_group_of_product && line.free_gift_based_on_group_of_product == true)//type 09
                ){
                    lines_remove.push(line)
                }
                if (!quantity_by_product_id[line.product.id]) {
                    quantity_by_product_id[line.product.id] = line.quantity;
                } else {
                    quantity_by_product_id[line.product.id] += line.quantity;
                }
                i++;
            }
            if (another_promo == false && this.pos.auto_promotion_new == false){
                this.remove_promotion_lines(lines_remove);
                this.pos.promotion_apply_disc_tot = false; // type 1
                this.pos.promotion_apply_disc_cat = false; // type 2
                this.pos.promotion_apply_disc_qty = false; // type 3
                this.pos.promotion_apply_disc_prod = false; // type 4
                this.pos.promotion_apply_free_prod = false; // type 5
                this.pos.promotion_apply_filter = false;//type 6
                this.pos.promotion_apply = false;
                this.pos.promotion_apply_9 = false;
                this.pos.promotion_apply_10 = false;
            }
            /*END*/
            /*code for auto promotion*/
            if(this.pos.auto_promotion_new == true){
                if (this.pr_st && this.old_promo == false){
                    return false;
                } else {
                    var stackable = false;
                    if (this.old_promo && promotion.stackable_in_promotion){
                        stackable = true;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion) {
                        stackable = true;
                    } else if(this.old_promo && promotion.stackable_in_promotion == false) {
                        stackable = false;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion == false) {
                        stackable = true;
                    }
                    for (i in quantity_by_product_id) {
                        var product_id = i;
                        var promotion_lines = this.pos.promotion_quantity_by_product_id[product_id];
                        if (!promotion_lines) {
							this.disc_qty = true;
                            break;
                        }
                        var quantity_tmp = 0;
                        var promotion_line = null;
                        var j = 0
                        for (j in promotion_lines) {
                            if (quantity_tmp <= promotion_lines[j].quantity && quantity_by_product_id[i] >= promotion_lines[j].quantity) {
                                promotion_line = promotion_lines[j];
                                quantity_tmp = promotion_lines[j].quantity
                            }
                        }
                        var lines = this.orderlines.models;
                        var amount_total_by_product = 0;
                        if (lines.length) {
                            var x = 0;
                            while (x < lines.length) {
                                if (lines[x].promotion) {
                                    x++;
                                    continue
                                }
                                if (lines[x].promotion_discount_by_quantity) {
                                    this.remove_orderline(lines[x]);
                                }
                                /*if (lines[x].product.id == product_id && lines[x].promotion != true) {
                                    amount_total_by_product += lines[x].get_price_without_tax()
                                }*/
                                if (pro_brand_id && pro_brand_id == lines[x].product.product_brand_id[0]) {
                                    if (lines[x].product.id == product_id && lines[x].promotion != true) {
                                        amount_total_by_product += lines[x].get_price_without_tax()
                                    }
                                }
                                if (!pro_brand_id){
                                    if (lines[x].product.id == product_id && lines[x].promotion != true) {
                                        amount_total_by_product += lines[x].get_price_without_tax()
                                    }
                                }//END
                                x++;
                            }
                        }
                        if (amount_total_by_product >= min_amt && promotion_line && !this.pos.promotion_apply_disc_qty && stackable == true) {
							/* update realtime promotion for type 3*/
							for (var m=0; m < applied_promo.length; m++){
								if (applied_promo[m].promos.type == promotion.type) {
									this.remove_promotion_lines([applied_promo[m]]);
									break;
								}
							}
                            /*if (promotion.discount_type == 'percent'){
                                this.add_product(product, {
                                    price: -amount_total_by_product / 100 * promotion_line.discount
                                })
                            }
                            else{
                                this.add_product(product, {
                                    price: -promotion_line.discount
                                })
                            }*/
                            if (promotion.discount_type == 'percent'){
                                if (max_disc > 0 && ((amount_total_by_product / 100 * promotion_line.discount) > max_disc)) {
                                    discount = max_disc;
                                } else {
                                    discount = amount_total_by_product / 100 * promotion_line.discount
                                }
                                this.add_product(product, {
                                    price: -discount
                                })
                            }
                            else{
                                if (max_disc > 0 && (promotion_line.discount) > max_disc) {
                                    discount = max_disc;
                                } else {
                                    discount = promotion_line.discount
                                }
                                this.add_product(product, {
                                    price: -discount
                                })
                            }

                            this.pos.promotion_apply_disc_qty = true; // type 3
                            var selected_line = this.get_selected_orderline();
                            selected_line.promotion_discount_by_quantity = true;
                            selected_line.promotion = true;
                            selected_line.promos = promotion;
                            this.disc_qty = false;
                            /*if (promotion.discount_type == 'percent'){
                                selected_line.promotion_reason = ' discount ' + promotion_line.discount + ' % when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
                            }else{
                                selected_line.promotion_reason = ' discount ' + promotion_line.discount + '  when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
                            }*/
                            if (promotion.discount_type == 'percent' && (amount_total_by_product / 100 * promotion_line.discount) <= max_disc){
                                selected_line.promotion_reason = ' discount ' + promotion_line.discount + ' % when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
                            } else if (promotion.discount_type == 'percent' && max_disc > 0 && (amount_total_by_product / 100 * promotion_line.discount) > max_disc){
                                selected_line.promotion_reason = ' discount ' + max_disc  //+ ' % when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
                            } else if (promotion.discount_type == 'amount' && max_disc > 0 && promotion_line.discount > max_disc){
                                selected_line.promotion_reason = ' discount ' + max_disc //+ '  when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
                            } else{
                                selected_line.promotion_reason = ' discount ' + promotion_line.discount + '  when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
                            }
                            selected_line.trigger('change', selected_line);
                        } else {
                            this.disc_qty = true;
                        }
						i++;
                    }

                }
            }
            if(this.pos.auto_promotion_new == false){
                for (i in quantity_by_product_id) {
                    var product_id = i;
                    var promotion_lines = this.pos.promotion_quantity_by_product_id[product_id];
                    if (!promotion_lines) {
                        continue;
                    }
                    var quantity_tmp = 0;
                    var promotion_line = null;
                    var j = 0
                    for (j in promotion_lines) {
                        if (quantity_tmp <= promotion_lines[j].quantity && quantity_by_product_id[i] >= promotion_lines[j].quantity) {
                            promotion_line = promotion_lines[j];
                            quantity_tmp = promotion_lines[j].quantity
                        }
                    }
                    var lines = this.orderlines.models;
                    var amount_total_by_product = 0;
                    if (lines.length) {
                        var x = 0;
                        while (x < lines.length) {
                            if (lines[x].promotion) {
                                x++;
                                continue
                            }
                            if (lines[x].promotion_discount_by_quantity) {
                                this.remove_orderline(lines[x]);
                            }
                            /*if (lines[x].product.id == product_id && lines[x].promotion != true) {
                                amount_total_by_product += lines[x].get_price_without_tax()
                            }*/ //strt
                            if (pro_brand_id && pro_brand_id == lines[x].product.product_brand_id[0]) {
                                if (lines[x].product.id == product_id && lines[x].promotion != true) {
                                    amount_total_by_product += lines[x].get_price_without_tax()
                                }
                            }
                            if (!pro_brand_id){
                                if (lines[x].product.id == product_id && lines[x].promotion != true) {
                                    amount_total_by_product += lines[x].get_price_without_tax()
                                }
                            }//END
                            x++;
                        }
                    }
                    if (amount_total_by_product >= min_amt && promotion_line && !this.pos.promotion_apply_disc_qty) {
                        /*if (promotion.discount_type == 'percent'){
                            this.add_product(product, {
                                price: -amount_total_by_product / 100 * promotion_line.discount
                            })
                        }
                        else{
                            this.add_product(product, {
                                price: -promotion_line.discount
                            })
                        }*/
                        if (promotion.discount_type == 'percent'){
                            if (max_disc > 0 && ((amount_total_by_product / 100 * promotion_line.discount) > max_disc)) {
                                discount = max_disc;
                            } else {
                                discount = amount_total_by_product / 100 * promotion_line.discount
                            }
                            this.add_product(product, {
                                price: -discount
                            })
                        }
                        else{
                            if (max_disc > 0 && (promotion_line.discount) > max_disc) {
                                discount = max_disc;
                            } else {
                                discount = promotion_line.discount
                            }
                            this.add_product(product, {
                                price: -discount
                            })
                        }

                        this.pos.promotion_apply_disc_qty = true; // type 3
                        var selected_line = this.get_selected_orderline();
                        selected_line.promotion_discount_by_quantity = true;
                        selected_line.promotion = true;
                        selected_line.promos = promotion;
                        this.disc_qty = false;
                        /*if (promotion.discount_type == 'percent'){
                            selected_line.promotion_reason = ' discount ' + promotion_line.discount + ' % when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
                        }else{
                            selected_line.promotion_reason = ' discount ' + promotion_line.discount + '  when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
                        }*/
                        if (promotion.discount_type == 'percent' && (amount_total_by_product / 100 * promotion_line.discount) <= max_disc){
	                        selected_line.promotion_reason = ' discount ' + promotion_line.discount + ' % when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
	                    } else if (promotion.discount_type == 'percent' && max_disc > 0 && (amount_total_by_product / 100 * promotion_line.discount) > max_disc){
	                        selected_line.promotion_reason = ' discount ' + max_disc  //+ ' % when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
	                    } else if (promotion.discount_type == 'amount' && max_disc > 0 && promotion_line.discount > max_disc){
	                        selected_line.promotion_reason = ' discount ' + max_disc //+ '  when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
	                    } else{
	                        selected_line.promotion_reason = ' discount ' + promotion_line.discount + '  when ' + promotion_line.product_id[1] + ' have quantity greater or equal ' + promotion_line.quantity + ' ' + selected_line.product.uom_id[1] + ' ';
	                    }
                        selected_line.trigger('change', selected_line);
                    }
					i++;
                }
             }
        },
        /*For Type 4 = By pack products discount products*/
        compute_pack_discount_fpp: function (promotion) {
            var promotion_condition_items = this.pos.promotion_discount_condition_by_promotion_id[promotion.id];
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var check = this.checking_can_apply_promotion_fpp(promotion_condition_items);
            var lines = this.orderlines.models;
            var lines_remove = [];
			var pro_brand_id = promotion.brand_id[0]; //Updated Based ON many2one
            var max_disc = promotion.max_disc_amt;
            var min_amt = promotion.min_amt;
            var amount_total_by_product = 0;
            var t = 0;
            for (t in promotion_condition_items){
                var promo_item = promotion_condition_items[t];
                var lines = this.orderlines.models;
                if (lines.length) {
                    var x = 0;
                    while (x < lines.length) {
                        if (lines[x].promotion) {
                            x++;
                            continue
                        }
                        if (pro_brand_id && pro_brand_id == lines[x].product.product_brand_id[0]) {
                            if (lines[x].product.id == promo_item.product_id[0]) {
                                amount_total_by_product += lines[x].get_price_without_tax()
                            }
                        }
                        if (!pro_brand_id){
                            if (lines[x].product.id == promo_item.product_id[0]) {
                                amount_total_by_product += lines[x].get_price_without_tax()
                            }
                        }//END
                        x++;
                    }
                }

            }
            var i = 0;
            var applied_promo = [];
            var l = 0;
            while (l < lines.length) {
                var line = lines[l];
                if (line.promos){
                    applied_promo.push(line);
                }
                l++;
            }
            var another_promo = false;
            for (var m=0; m < applied_promo.length; m++){
                another_promo = applied_promo[m].promos.stackable_in_promotion;
            }
            while (i < lines.length) {
                var line = lines[i];
                if ((line.promotion_discount_total_order && line.promotion_discount_total_order == true)//type1
                || (line.promotion_discount_category && line.promotion_discount_category == true)//type2
                || (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true)//type3
                || (line.promotion_discount && line.promotion_discount == true)//type4
                || (line.promotion_gift && line.promotion_gift == true)//type5
                || (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true)//type6
                || (line.promotion_brand_gift_condition && line.promotion_brand_gift_condition == true)//type 7
                || (line.promotion_product_gift_condition && line.promotion_product_gift_condition == true)//type 8
                || (line.free_gift_based_on_group_of_product && line.free_gift_based_on_group_of_product == true)//type 09
                ){
                    lines_remove.push(line)
                }
                i++;
            }
            if (another_promo == false && this.pos.auto_promotion_new == false){
                this.remove_promotion_lines(lines_remove);
                this.pos.promotion_apply_disc_tot = false; // type 1
                this.pos.promotion_apply_disc_cat = false; // type 2
                this.pos.promotion_apply_disc_qty = false; // type 3
                this.pos.promotion_apply_disc_prod = false; // type 4
                this.pos.promotion_apply_free_prod = false; // type 5
                this.pos.promotion_apply_filter = false;//type 6
                this.pos.promotion_apply = false;
                this.pos.promotion_apply_9 = false;
                this.pos.promotion_apply_10 = false;
            }
            /*END*/
            /*code for auto promotion*/
            if(this.pos.auto_promotion_new == true){
                if (this.pr_st && this.old_promo == false){
                    return false;
                } else {
                    var stackable = false;
                    if (this.old_promo && promotion.stackable_in_promotion){
                        stackable = true;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion) {
                        stackable = true;
                    } else if(this.old_promo && promotion.stackable_in_promotion == false) {
                        stackable = false;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion == false) {
                            stackable = true;
                    }
                    if (check == true) {
                        var discount_items = this.pos.promotion_discount_apply_by_promotion_id[promotion.id]
                        if (!discount_items) {
                            return;
                        }
                        var i = 0;
                        while (i < discount_items.length) {
                            var discount_item = discount_items[i];
                            var discount = 0;
                            var lines = this.orderlines.models;
                            for (var x = 0; x < lines.length; x++) {
                                if (lines[x].promotion) {
                                    continue;
                                }
                                if (lines[x].product.id == discount_item.product_id[0]) {
                                    discount += lines[x].get_price_without_tax()
                                }
                            }
                            if (product && amount_total_by_product >= min_amt && !this.pos.promotion_apply_disc_prod && stackable == true) {
								/* update realtime promotion for type 4*/
								for (var m=0; m < applied_promo.length; m++){
									if (applied_promo[m].promos.type == promotion.type) {
										this.remove_promotion_lines([applied_promo[m]]);
										break;
									}
								}

                                if (promotion.discount_type == 'percent'){
                                    if (max_disc > 0 && ((discount / 100 * discount_item.discount) > max_disc)) {
                                        discount = max_disc;
                                    } else {
                                        discount = discount / 100 * discount_item.discount
                                    }
                                    this.add_product(product, {
                                        price: -discount
                                    })
                                }
                                else{
                                    if (max_disc > 0 && (discount_item.discount) > max_disc) {
                                        discount = max_disc;
                                    } else {
                                        discount = discount_item.discount
                                    }
                                    this.add_product(product, {
                                        price: -discount
                                    })
                                }
                                this.pos.promotion_apply_disc_prod = true; // type 4
                                var selected_line = this.get_selected_orderline();
                                selected_line.promotion_discount = true;
                                selected_line.promotion = true;
                                selected_line.promos = promotion;
                                this.pp_disc = false;
                                if (promotion.discount_type == 'percent' && (discount / 100 * discount_item.discount) <= max_disc){
                                    selected_line.promotion_reason = ' discount ' + discount_item.discount + ' % ' + promotion.name;
                                } else if (promotion.discount_type == 'percent' && max_disc > 0 && (discount / 100 * discount_item.discount) > max_disc){
                                    selected_line.promotion_reason = ' discount ' + discount_item.discount + ' % ' + promotion.name;
                                } else if (promotion.discount_type == 'amount' && max_disc > 0 && discount_item.discount > max_disc){
                                    selected_line.promotion_reason = ' discount ' + discount_item.discount + '   ' + promotion.name;
                                } else{
                                    selected_line.promotion_reason = ' discount ' + discount_item.discount + '   ' + promotion.name;
                                }
                                selected_line.trigger('change', selected_line);
                            } else {
                                this.pp_disc = true;
                            }
                            i++;
                        }
                    } else {
                        this.pp_disc = true;
                    }
                }
            }
            if(this.pos.auto_promotion_new == false){
                if (check == true) {
                    var discount_items = this.pos.promotion_discount_apply_by_promotion_id[promotion.id]
                    if (!discount_items) {
                        return;
                    }
                    var i = 0;
                    while (i < discount_items.length) {
                        var discount_item = discount_items[i];
                        var discount = 0;
                        var lines = this.orderlines.models;
                        var total_of_pack_dis = 0;
                        for (var x = 0; x < lines.length; x++) {
                            if (lines[x].promotion) {
                                continue;
                            }
                            if (lines[x].product.id == discount_item.product_id[0]) {
                                discount += lines[x].get_price_without_tax()
                            }
                        }
                        if (product && amount_total_by_product >= min_amt && !this.pos.promotion_apply_disc_prod) {
                            if (promotion.discount_type == 'percent'){
                                if (max_disc > 0 && ((discount / 100 * discount_item.discount) > max_disc)) {
                                    discount = max_disc;
                                } else {
                                    discount = discount / 100 * discount_item.discount
                                }
                                this.add_product(product, {
                                    price: -discount
                                })
                            }
                            else{
                                if (max_disc > 0 && (discount_item.discount) > max_disc) {
                                    discount = max_disc;
                                } else {
                                    discount = discount_item.discount
                                }
                                this.add_product(product, {
                                    price: -discount
                                })
                            }

                            this.pos.promotion_apply_disc_prod = true; // type 4
                            var selected_line = this.get_selected_orderline();
                            selected_line.promotion_discount = true;
                            selected_line.promotion = true;
                            selected_line.promos = promotion;
                            this.pp_disc = false;
                            if (promotion.discount_type == 'percent' && (discount / 100 * discount_item.discount) <= max_disc){
                                selected_line.promotion_reason = ' discount ' + discount_item.discount + ' % ' + promotion.name;
                            } else if (promotion.discount_type == 'percent' && max_disc > 0 && (discount / 100 * discount_item.discount) > max_disc){
                                selected_line.promotion_reason = ' discount ' + discount_item.discount + ' % ' + promotion.name;
                            } else if (promotion.discount_type == 'amount' && max_disc > 0 && discount_item.discount > max_disc){
                                selected_line.promotion_reason = ' discount ' + discount_item.discount + '   ' + promotion.name;
                            } else{
                                selected_line.promotion_reason = ' discount ' + discount_item.discount + '   ' + promotion.name;
                            }
                            selected_line.trigger('change', selected_line);
                        }
                        i++;
                    }
                }
            }
        },
        /*For Type 5 = By pack products free products*/
        compute_pack_free_gift_fpp: function (promotion) {
            var promotion_condition_items = this.pos.promotion_gift_condition_by_promotion_id[promotion.id];
            var check = this.checking_can_apply_promotion_fpp(promotion_condition_items);
            /*start code from here*/
            var pro_brand_id = promotion.brand_id[0]; //Updated Based ON many2one
            var max_disc = promotion.max_disc_amt;
            var min_amt = promotion.min_amt;
            var amount_total_by_product = 0;
            var t = 0;
            for (t in promotion_condition_items){
                var promo_item = promotion_condition_items[t];
                var lines = this.orderlines.models;
                if (lines.length) {
                    var x = 0;
                    while (x < lines.length) {
                        if (lines[x].promotion) {
                            x++;
                            continue
                        }
                        if (pro_brand_id && pro_brand_id == lines[x].product.product_brand_id[0]) {
                            if (lines[x].product.id == promo_item.product_id[0]) {
                                amount_total_by_product += lines[x].get_price_without_tax()
                            }
                        }
                        if (!pro_brand_id){
                            if (lines[x].product.id == promo_item.product_id[0]) {
                                amount_total_by_product += lines[x].get_price_without_tax()
                            }
                        }//END
                        x++;
                    }
                }

            }
            var lines = this.orderlines.models;
            var lines_remove = [];
            var i = 0;
            var applied_promo = [];
            var l = 0;
            while (l < lines.length) {
                var line = lines[l];
                if (line.promos){
                    applied_promo.push(line);
                }
                l++;
            }
            var another_promo = false;
            for (var m=0; m < applied_promo.length; m++){
                another_promo = applied_promo[m].promos.stackable_in_promotion;
            }
            while (i < lines.length) {
                var line = lines[i];
                if ((line.promotion_discount_total_order && line.promotion_discount_total_order == true)//type1
                || (line.promotion_discount_category && line.promotion_discount_category == true)//type2
                || (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true)//type3
                || (line.promotion_discount && line.promotion_discount == true)//type4
                || (line.promotion_gift && line.promotion_gift == true)//type5
                || (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true)//type6
                || (line.promotion_brand_gift_condition && line.promotion_brand_gift_condition == true)//type 7
                || (line.promotion_product_gift_condition && line.promotion_product_gift_condition == true)//type 8
                || (line.free_gift_based_on_group_of_product && line.free_gift_based_on_group_of_product == true)//type 09
                ){
                    lines_remove.push(line)
                }
                i++;
            }
            if (another_promo == false && this.pos.auto_promotion_new == false){
                this.remove_promotion_lines(lines_remove);
                this.pos.promotion_apply_disc_tot = false; // type 1
                this.pos.promotion_apply_disc_cat = false; // type 2
                this.pos.promotion_apply_disc_qty = false; // type 3
                this.pos.promotion_apply_disc_prod = false; // type 4
                this.pos.promotion_apply_free_prod = false; // type 5
                this.pos.promotion_apply_filter = false; //type 6
                this.pos.promotion_apply = false;
                this.pos.promotion_apply_9 = false;
                this.pos.promotion_apply_10 = false;
            }
            /*END*/
            /*code for auto promotion*/
            if(this.pos.auto_promotion_new == true){
                if (this.pr_st && this.old_promo == false){
                    return false;
                } else {
                    var stackable = false;
                    if (this.old_promo && promotion.stackable_in_promotion){
                        stackable = true;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion) {
                        stackable = true;
                    } else if(this.old_promo && promotion.stackable_in_promotion == false) {
                        stackable = false;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion == false) {
                        stackable = true;
                    }

                    if (check == true && amount_total_by_product >= min_amt) {
                        var gifts = this.pos.promotion_gift_free_by_promotion_id[promotion.id]
                        if (!gifts) {
                            return;
                        }
                        var i = 0;
                        while (i < gifts.length) {
                            var product = this.pos.db.get_product_by_id(gifts[i].product_id[0]);
                            if (product && !this.pos.promotion_apply_free_prod && stackable == true) {
								/* update realtime promotion for type 5*/
								for (var m=0; m < applied_promo.length; m++){
									if (applied_promo[m].promos.type == promotion.type) {
										this.remove_promotion_lines([applied_promo[m]]);
										break;
									}
								}
                                this.add_product(product, {
                                    price: 0, quantity: gifts[i].quantity_free
                                })
                                this.pos.promotion_apply_free_prod = true; // type 5
                                var selected_line = this.get_selected_orderline();
                                selected_line.promotion_gift = true;
                                selected_line.promotion = true;
                                selected_line.promos = promotion;
                                this.pp_free = false;
                                selected_line.promotion_reason = ' gift of Pack name: ' + promotion.name;
                                selected_line.trigger('change', selected_line);
                            } else {
                                this.pp_free = true;                            
                            }
                            i++;
                        }
                    } else {
                        this.pp_free = true;
                    }
                }
            }

            if(this.pos.auto_promotion_new == false){
                if (check == true && amount_total_by_product >= min_amt) {
                    var gifts = this.pos.promotion_gift_free_by_promotion_id[promotion.id]
                    if (!gifts) {
                        return;
                    }
                    var i = 0;
                    while (i < gifts.length) {
                        var product = this.pos.db.get_product_by_id(gifts[i].product_id[0]);
                        if (product && !this.pos.promotion_apply_free_prod) {
                            this.add_product(product, {
                                price: 0, quantity: gifts[i].quantity_free
                            })
                            this.pos.promotion_apply_free_prod = true; // type 5
                            var selected_line = this.get_selected_orderline();
                            selected_line.promotion_gift = true;
                            selected_line.promotion = true;
                            selected_line.promos = promotion;
                            this.pp_free = false;
                            selected_line.promotion_reason = ' gift of Pack name: ' + promotion.name;
                            selected_line.trigger('change', selected_line);
                        }
                        i++;
                    }
                }
            }
        },
        /*For Type 6 = Price product filter by quantity*/
        compute_price_filter_quantity_fpp: function (promotion) {
            var promotion_prices = this.pos.promotion_price_by_promotion_id[promotion.id]
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var pro_brand_id = promotion.brand_id[0]; //Updated Based ON many2one
            var max_disc = promotion.max_disc_amt;
            var min_amt = promotion.min_amt;
            //var discount = 0;
            var amount_total_by_product = 0;
            var t = 0;
            for (t in promotion_prices){
                var promo_price = promotion_prices[t];
                var lines = this.orderlines.models;
                if (lines.length) {
                    var x = 0;
                    while (x < lines.length) {
                        if (lines[x].promotion) {
                            x++;
                            continue
                        }
                        if (pro_brand_id && pro_brand_id == lines[x].product.product_brand_id[0]) {
                            if (lines[x].product.id == promo_price.product_id[0]) {
                                amount_total_by_product += lines[x].get_price_without_tax()
                            }
                        }
                        if (!pro_brand_id){
                            if (lines[x].product.id == promo_price.product_id[0]) {
                                amount_total_by_product += lines[x].get_price_without_tax()
                            }
                        }//END
                        x++;
                    }
                }

            }
            /*start code from here*/
            var lines = this.orderlines.models;
            var lines_remove = [];
            var i = 0;
            var applied_promo = [];
            var l = 0;
            while (l < lines.length) {
                var line = lines[l];
                if (line.promos){
                    applied_promo.push(line);
                }
                l++;
            }
            var another_promo = false;
            for (var m=0; m < applied_promo.length; m++){
                another_promo = applied_promo[m].promos.stackable_in_promotion;
            }
            while (i < lines.length) {
                var line = lines[i];
                if ((line.promotion_discount_total_order && line.promotion_discount_total_order == true)//type1
                || (line.promotion_discount_category && line.promotion_discount_category == true)//type2
                || (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true)//type3
                || (line.promotion_discount && line.promotion_discount == true)//type4
                || (line.promotion_gift && line.promotion_gift == true)//type5
                || (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true)//type6
                || (line.promotion_brand_gift_condition && line.promotion_brand_gift_condition == true)//type 7
                || (line.promotion_product_gift_condition && line.promotion_product_gift_condition == true)//type 8
                || (line.free_gift_based_on_group_of_product && line.free_gift_based_on_group_of_product == true)//type 09
                ){
                    lines_remove.push(line)
                }
                i++;
            }
            if (another_promo == false && this.pos.auto_promotion_new == false){
                this.remove_promotion_lines(lines_remove);
                this.pos.promotion_apply_disc_tot = false; // type 1
                this.pos.promotion_apply_disc_cat = false; // type 2
                this.pos.promotion_apply_disc_qty = false; // type 3
                this.pos.promotion_apply_disc_prod = false; // type 4
                this.pos.promotion_apply_free_prod = false; // type 5
                this.pos.promotion_apply_filter = false; //type 6
                this.pos.promotion_apply = false;
                this.pos.promotion_apply_9 = false;
                this.pos.promotion_apply_10 = false;
            }
            /*END*/
            /*code for auto promotion*/
            if(this.pos.auto_promotion_new == true){
                if (this.pr_st && this.old_promo == false){
                    return false;
                } else {
                    var stackable = false;
                    if (this.old_promo && promotion.stackable_in_promotion){
                        stackable = true;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion) {
                        stackable = true;
                    } else if(this.old_promo && promotion.stackable_in_promotion == false) {
                        stackable = false;
                    } else if(this.old_promo == false && promotion.stackable_in_promotion == false) {
                        stackable = true;
                    }
                    if (promotion_prices) {
                        var prices_item_by_product_id = {};
                        for (var i = 0; i < promotion_prices.length; i++) {
                            var item = promotion_prices[i];
                            if (!prices_item_by_product_id[item.product_id[0]]) {
                                prices_item_by_product_id[item.product_id[0]] = [item]
                            } else {
                                prices_item_by_product_id[item.product_id[0]].push(item)
                            }
                        }
					
                        var quantity_by_product_id = this.get_product_and_quantity_current_order_fpp()
                        var discount = 0;
                        for (i in quantity_by_product_id) {
                            if (prices_item_by_product_id[i]) {
								var quantity_tmp = 0
                                var price_item_tmp = null
                                // root: quantity line, we'll compare this with 2 variable quantity line greater minimum quantity of item and greater quantity temp
                                for (var j = 0; j < prices_item_by_product_id[i].length; j++) {
                                    var price_item = prices_item_by_product_id[i][j];
                                    if (quantity_by_product_id[i] >= price_item.minimum_quantity && quantity_by_product_id[i] >= quantity_tmp) {
                                        quantity_tmp = price_item.minimum_quantity;
                                        price_item_tmp = price_item;
                                    }
                                }
                                if (price_item_tmp) {
                                    var discount = 0;
                                    var z = 0;
                                    while (z < lines.length) {
                                        var line = lines[z];
                                        if (line.product.id == price_item_tmp.product_id[0]) {
                                            discount += line.get_price_without_tax() - (line.quantity * price_item_tmp.list_price)
                                        }
                                        z++;
                                    }
                                    if (discount > 0 && amount_total_by_product >=  min_amt && !this.pos.promotion_apply_filter && stackable == true) {
										/* update realtime promotion for type 6*/
										for (var m=0; m < applied_promo.length; m++){
											if (applied_promo[m].promos.type == promotion.type) {
												this.remove_promotion_lines([applied_promo[m]]);
												break;
											}
										}
                                        /*this.add_product(product, {
                                            price: -discount
                                        })*/
                                        if (max_disc > 0 && discount > max_disc) {
                                            discount = max_disc;
                                        } else {
                                            discount = discount;
                                        }
                                        this.add_product(product, {
                                            price: -discount
                                        })
                                        this.pos.promotion_apply_filter = true;//type 6
                                        var selected_line = this.get_selected_orderline();
                                        selected_line.promotion_price_by_quantity = true;
                                        selected_line.promotion = true;
                                        selected_line.promos = promotion;
                                        this.ppf_qty = false;
//                                        selected_line.promotion_reason = ' By greater or equal ' + price_item_tmp.minimum_quantity + ' ' + selected_line.product.uom_id[1] + ' ' + price_item_tmp.product_id[1] + ' applied price ' + price_item_tmp.list_price
                                        if (max_disc > 0 && discount > max_disc){
                                            selected_line.promotion_reason = ' By greater or equal ' + price_item_tmp.minimum_quantity + ' ' + selected_line.product.uom_id[1] + ' ' + price_item_tmp.product_id[1] + ' applied price ' + price_item_tmp.list_price
                                        } else{
                                            selected_line.promotion_reason = ' By greater or equal ' + price_item_tmp.minimum_quantity + ' ' + selected_line.product.uom_id[1] + ' ' + price_item_tmp.product_id[1] + ' applied price ' + price_item_tmp.list_price
                                        }
                                        selected_line.trigger('change', selected_line);
                                    } else {
                                        this.ppf_qty = true;
                                    }
                                }
								
                            }else {
                                this.ppf_qty = true;
                            }
							
                        }

                    }

                }
            }

            if(this.pos.auto_promotion_new == false){
                if (promotion_prices) {
                    var prices_item_by_product_id = {};
                    for (var i = 0; i < promotion_prices.length; i++) {
                        var item = promotion_prices[i];
                        if (!prices_item_by_product_id[item.product_id[0]]) {
                            prices_item_by_product_id[item.product_id[0]] = [item]
                        } else {
                            prices_item_by_product_id[item.product_id[0]].push(item)
                        }
                    }
                    var quantity_by_product_id = this.get_product_and_quantity_current_order_fpp()
                    var discount = 0;
                    for (i in quantity_by_product_id) {
                        if (prices_item_by_product_id[i]) {
                            var quantity_tmp = 0
                            var price_item_tmp = null
                            // root: quantity line, we'll compare this with 2 variable quantity line greater minimum quantity of item and greater quantity temp
                            for (var j = 0; j < prices_item_by_product_id[i].length; j++) {
                                var price_item = prices_item_by_product_id[i][j];
                                if (quantity_by_product_id[i] >= price_item.minimum_quantity && quantity_by_product_id[i] >= quantity_tmp) {
                                    quantity_tmp = price_item.minimum_quantity;
                                    price_item_tmp = price_item;
                                }
                            }
                            if (price_item_tmp) {
                                var discount = 0;
                                var z = 0;
                                while (z < lines.length) {
                                    var line = lines[z];
                                    if (line.product.id == price_item_tmp.product_id[0]) {
                                        discount += line.get_price_without_tax() - (line.quantity * price_item_tmp.list_price)
                                    }
                                    z++;
                                }
                                if (discount > 0 && amount_total_by_product >=  min_amt && !this.pos.promotion_apply_filter) {
                                    /*this.add_product(product, {
                                        price: -discount
                                    })*/
                                    if (max_disc > 0 && discount > max_disc) {
                                        discount = max_disc;
                                    } else {
                                        discount = discount;
                                    }
                                    this.add_product(product, {
                                        price: -discount
                                    })
                                    this.pos.promotion_apply_filter = true;//type 6
                                    var selected_line = this.get_selected_orderline();
                                    selected_line.promotion_price_by_quantity = true;
                                    selected_line.promotion = true;
                                    selected_line.promos = promotion;
                                    this.ppf_qty = false;
                                    //selected_line.promotion_reason = ' By greater or equal ' + price_item_tmp.minimum_quantity + ' ' + selected_line.product.uom_id[1] + ' ' + price_item_tmp.product_id[1] + ' applied price ' + price_item_tmp.list_price
                                    if (max_disc > 0 && discount > max_disc){
                                        selected_line.promotion_reason = ' By greater or equal ' + price_item_tmp.minimum_quantity + ' ' + selected_line.product.uom_id[1] + ' ' + price_item_tmp.product_id[1] + ' applied price ' + price_item_tmp.list_price
                                    } else{
                                        selected_line.promotion_reason = ' By greater or equal ' + price_item_tmp.minimum_quantity + ' ' + selected_line.product.uom_id[1] + ' ' + price_item_tmp.product_id[1] + ' applied price ' + price_item_tmp.list_price
                                    }
                                    selected_line.trigger('change', selected_line);
                                }
                            }
                        }
                    }

                }
            }
        },
        /*----*/
        //For Type Discount BY Brands
        compute_brand_product_pos: function (promotion) {
            var lines = this.orderlines.models;
            var promo = this.pos.selected_promo;
            var product = this.pos.db.get_product_by_id(promotion.product_id[0]);
            var lines_remove = [];
            var i = 0;
            var applied_promo = [];
            var l = 0;
            while (l < lines.length) {
                var line = lines[l];
                if (line.promos){
                    applied_promo.push(line);
                }
                l++;
            }
            var another_promo = false;
            for (var m=0; m < applied_promo.length; m++){
                another_promo = applied_promo[m].promos.stackable_in_promotion;
            }
            while (i < lines.length) {
                var line = lines[i];
                if ((line.promotion_discount_total_order && line.promotion_discount_total_order == true)//type1
                || (line.promotion_discount_category && line.promotion_discount_category == true)//type2
                || (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true)//type3
                || (line.promotion_discount && line.promotion_discount == true)//type4
                || (line.promotion_gift && line.promotion_gift == true)//type5
                || (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true)//type6
                || (line.promotion_brand_gift_condition && line.promotion_brand_gift_condition == true)//type 7
                || (line.promotion_product_gift_condition && line.promotion_product_gift_condition == true)//type 8
                || (line.free_gift_based_on_group_of_product && line.free_gift_based_on_group_of_product == true)//type 09
                ){
                    lines_remove.push(line)
                }
                i++;
            }
            if (another_promo == false && this.pos.auto_promotion_new == false){
                this.remove_promotion_lines(lines_remove);
                this.pos.promotion_apply_disc_tot = false; // type 1
                this.pos.promotion_apply_disc_cat = false; // type 2
                this.pos.promotion_apply_disc_qty = false; // type 3
                this.pos.promotion_apply_disc_prod = false; // type 4
                this.pos.promotion_apply_free_prod = false; // type 5
                this.pos.promotion_apply_filter = false; //type 6
                this.pos.promotion_apply = false;
                this.pos.promotion_apply_9 = false;
                this.pos.promotion_apply_10 = false;
            }
            // && this.pr_st == true
            if(this.pos.auto_promotion_new == true){
                if (this.pr_st && this.old_promo == false){
                    return false;
                } else {
                    var j = 0;
                    for (j in this.pos.promotion_brand_gift_condition_by_promotion_id[promotion.id]) {
                        var total_order = this.get_total_without_promotion_and_tax();
                        var min_amt = promotion.min_amt;
                        var max_disc = promotion.max_disc_amt;
                        var promotion_line = this.pos.promotion_brand_gift_condition_by_promotion_id[promotion.id][j];
                        var z = 0;
                        var method_count = false;
                        var stackable = false;
                        var bybrand = false;
                        while (z < lines.length) {
                            if (!lines[z].product.product_brand_id) {
                                z++;
                                continue;
                            }
                            if (_.indexOf(promotion_line.brand_ids, lines[z].product.product_brand_id[0]) >= 0) {
                                bybrand = true
                            }
                            z++;
                        }
                        if (this.old_promo && promotion.stackable_in_promotion){
                            stackable = true;
                        } else if(this.old_promo == false && promotion.stackable_in_promotion) {
                            stackable = true;
                        } else if(this.old_promo && promotion.stackable_in_promotion == false) {
                            stackable = false;
                        } else if(this.old_promo == false && promotion.stackable_in_promotion == false) {
                            stackable = true;
                        }
                        if (bybrand && total_order >= min_amt) {
						    method_count = true;
					    }
                        if (method_count == true && !this.pos.promotion_apply && stackable == true) {
                            if(lines.length > 0 && promotion_line.brand_ids.length > 0){
                                var total = 0;
                                var discount = 0;
                                for (var br = 0; br < lines.length; br++) {
                                     if (_.indexOf(promotion_line.brand_ids, lines[br].product.product_brand_id[0]) >= 0) {
										
										/* update realtime promotion for type 7*/
										for (var m=0; m < applied_promo.length; m++){
											if (applied_promo[m].promos.type == promotion.type) {
												this.remove_promotion_lines([applied_promo[m]]);
												//break;
											}
										}

                                        total = lines[br].price * lines[br].quantity
                                        if (promotion.discount_type == 'percent'){
                                            if (max_disc > 0 && ((total / 100 * promotion_line.discount) > max_disc)) {
                                                discount = max_disc;
                                            } else {
                                                discount = total / 100 * promotion_line.discount
                                            }
                                            this.add_product(product, {
                                                price: -discount

                                            })
                                        }
                                        else{
                                            if (max_disc > 0 && promotion_line.discount > max_disc) {
                                                discount = max_disc;
                                            } else {
                                                discount = promotion_line.discount
                                            }
                                            this.add_product(product, {
                                                price: -discount
                                            })
                                        }
                                        //this.pos.promotion_apply = true;
                                        var selected_line = this.get_selected_orderline();
                                        selected_line.promotion_brand_gift_condition = true;
                                        selected_line.promotion = true;
                                        selected_line.promos = promotion;
                                        this.by_brand = false;
                                        if (promotion.discount_type == 'percent' && (total / 100 * promotion_line.discount) <= max_disc){
	                                        selected_line.promotion_reason = ' discount ' + promotion_line.discount + ' % ' + promotion.name;
	                                    } else if (promotion.discount_type == 'percent' && max_disc > 0 && (total / 100 * promotion_line.discount) > max_disc){
	                                        selected_line.promotion_reason = ' discount ' + max_disc  + ' ' + promotion.name;
	                                    } else if (promotion.discount_type == 'amount' && max_disc > 0 && promotion_line.discount > max_disc){
	                                        selected_line.promotion_reason = ' discount ' + max_disc + ' ' + promotion.name;
	                                    } else{
	                                        selected_line.promotion_reason = ' discount ' + promotion_line.discount + '   ' + promotion.name;
	                                    }
                                        selected_line.trigger('change', selected_line);
                                        //break;
                                     }
                                }

                            }
                        } else {
                            this.by_brand = true;
                        }
                        j++;
                    }
                    this.pos.promotion_apply = true;
                }
            }
            if(this.pos.auto_promotion_new == false){
                var j = 0;
                for (j in this.pos.promotion_brand_gift_condition_by_promotion_id[promotion.id]) {
                    var promotion_line = this.pos.promotion_brand_gift_condition_by_promotion_id[promotion.id][j];
                    var total_order = this.get_total_without_promotion_and_tax();
                    var min_amt = promotion.min_amt;
                    var max_disc = promotion.max_disc_amt;
                    var z = 0;
                    var method_count = false;
                    var bybrand = false;
                    while (z < lines.length) {
                        if (!lines[z].product.product_brand_id) {
                            z++;
                            continue;
                        }
                        if (_.indexOf(promotion_line.brand_ids, lines[z].product.product_brand_id[0]) >= 0) {
                            bybrand = true;
                            //method_count = true
                        }
                        z++;
                    }
                    // && !this.pos.promotion_apply
                    if (bybrand && total_order >= min_amt) {
					    method_count = true;
                    }
                    if (method_count == true) {
                        for (var m=0; m < applied_promo.length; m++){
                            if (applied_promo[m].promos.type == promotion.type) {
                                this.remove_promotion_lines([applied_promo[m]]);
                            }
                        }
                        if(lines.length > 0 && promotion_line.brand_ids.length > 0){
                            var total = 0;
                            var discount = 0;
                            for (var br = 0; br < lines.length; br++) {
                                 if (_.indexOf(promotion_line.brand_ids, lines[br].product.product_brand_id[0]) >= 0) {
                                    total = lines[br].price * lines[br].quantity
                                    if (promotion.discount_type == 'percent'){
                                        if (max_disc > 0 && ((total / 100 * promotion_line.discount) > max_disc)) {
                                            discount = max_disc;
                                        } else {
                                            discount = total / 100 * promotion_line.discount
                                        }
                                        this.add_product(product, {
                                            price: -discount
                                        })
                                    }
                                    else{
                                        if (max_disc > 0 && promotion_line.discount > max_disc) {
                                            discount = max_disc;
                                        } else {
                                            discount = promotion_line.discount
                                        }
                                        this.add_product(product, {
                                            price: -discount
                                        })
                                    }
                                    this.pos.promotion_apply = true;
                                    var selected_line = this.get_selected_orderline();
                                    selected_line.promotion_brand_gift_condition = true;
                                    selected_line.promotion = true;
                                    selected_line.promos = promotion;
                                    this.by_brand = false;
                                    if (promotion.discount_type == 'percent' && (total / 100 * promotion_line.discount) <= max_disc){
	                                    selected_line.promotion_reason = ' discount ' + promotion_line.discount + ' % ' + promotion.name;
	                                } else if (promotion.discount_type == 'percent' && max_disc > 0 && (total / 100 * promotion_line.discount) > max_disc){
	                                    selected_line.promotion_reason = ' discount ' + max_disc  + ' ' + promotion.name;
	                                } else if (promotion.discount_type == 'amount' && max_disc > 0 && promotion_line.discount > max_disc){
	                                    selected_line.promotion_reason = ' discount ' + max_disc + ' ' + promotion.name;
	                                } else{
	                                    selected_line.promotion_reason = ' discount ' + promotion_line.discount + '   ' + promotion.name;
	                                }

                                    selected_line.trigger('change', selected_line);
                                    break;
                                 }
                            }

                        }
                    }
                    j++;
                }
            }
            
        },
        /*For buy products free products*/
        compute_product_product_pos: function (promotion) {
        	var lines = this.orderlines.models;
        	var promo = this.pos.selected_promo;
        	var pro_brand_id = promotion.brand_id[0]; //Updated Based ON many2one
            var max_disc = promotion.max_disc_amt;
            var min_amt = promotion.min_amt;
            var discount = 0;
            var lines_remove = [];
            var i = 0;
            var applied_promo = [];
            var l = 0;
            while (l < lines.length) {
                var line = lines[l];
                if (line.promos){
                    applied_promo.push(line);
                }
                l++;
            }
            var another_promo = false;
            for (var m=0; m < applied_promo.length; m++){
                another_promo = applied_promo[m].promos.stackable_in_promotion;
            }
            while (i < lines.length) {
                var line = lines[i];
                if ((line.promotion_discount_total_order && line.promotion_discount_total_order == true)//type1
                || (line.promotion_discount_category && line.promotion_discount_category == true)//type2
                || (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true)//type3
                || (line.promotion_discount && line.promotion_discount == true)//type4
                || (line.promotion_gift && line.promotion_gift == true)//type5
                || (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true)//type6
                || (line.promotion_brand_gift_condition && line.promotion_brand_gift_condition == true)//type 7
                || (line.promotion_product_gift_condition && line.promotion_product_gift_condition == true)//type 8
                || (line.free_gift_based_on_group_of_product && line.free_gift_based_on_group_of_product == true)//type 09
                ){
                    lines_remove.push(line)
                }
                i++;
            }
            if (another_promo == false && this.pos.auto_promotion_new == false){
                this.remove_promotion_lines(lines_remove);
                this.pos.promotion_apply_disc_tot = false; // type 1
                this.pos.promotion_apply_disc_cat = false; // type 2
                this.pos.promotion_apply_disc_qty = false; // type 3
                this.pos.promotion_apply_disc_prod = false; // type 4
                this.pos.promotion_apply_free_prod = false; // type 5
                this.pos.promotion_apply_filter = false; //type 6
                this.pos.promotion_apply = false;
                this.pos.promotion_apply_9 = false;
                this.pos.promotion_apply_10 = false;
            }   
            if(this.pos.auto_promotion_new == true){
                if (this.pr_st && this.old_promo == false){
                    return false;
                } else {
                    var j = 0;
                    for (j in this.pos.promotion_product_gift_condition_by_promotion_id[promotion.id]) {
                    	var promotion_line = this.pos.promotion_product_gift_condition_by_promotion_id[promotion.id][j];
                        var z = 0;
                        var method_count = false;
                        var stackable = false;
						var min_amt = promotion.min_amt;
						var total_order = this.get_total_without_promotion_and_tax();
						var free_pro = false;
                        var ff_qty = 0;
                        var dm_free_gifts = promotion.dm_free_gifts;
                        var free_qty = promotion.qty_free;
                        while (z < lines.length) {
                            if (!lines[z].product.id) {
                                z++;
                                continue;
                            }
                            /*if (lines[z].product.id == promotion_line.product_id[0] && lines[z].quantity >= promotion_line.minimum_quantity) {
                                //method_count = true;
								free_pro = true;
								var pr_qty = lines[z].quantity
                                if(dm_free_gifts == true){
                                    ff_qty += pr_qty * free_qty
                                }
                            }*/
                            if (pro_brand_id && pro_brand_id == lines[z].product.product_brand_id[0]) {
                                if (lines[z].product.id == promotion_line.product_id[0] && lines[z].quantity >= promotion_line.minimum_quantity) {
                                    //method_count = true;
                                    free_pro = true;
                                    var pr_qty = lines[z].quantity
                                    if(dm_free_gifts == true){
                                        ff_qty += pr_qty * free_qty
                                    }
                                }
                            }
                            if (!pro_brand_id){
                                if (lines[z].product.id == promotion_line.product_id[0] && lines[z].quantity >= promotion_line.minimum_quantity) {
                                    //method_count = true;
                                    free_pro = true;
                                    var pr_qty = lines[z].quantity
                                    if(dm_free_gifts == true){
                                        ff_qty += pr_qty * free_qty
                                    }
                                }
                            }//END
                            z++;
                        }
                        if (this.old_promo && promotion.stackable_in_promotion){
                            stackable = true;
                        } else if(this.old_promo == false && promotion.stackable_in_promotion) {
                            stackable = true;
                        } else if(this.old_promo && promotion.stackable_in_promotion == false) {
                            stackable = false;
                        } else if(this.old_promo == false && promotion.stackable_in_promotion == false) {
                            stackable = true;
                        }
						if (free_pro && total_order >= min_amt) {
							method_count = true;
						}
                        if (method_count == true && !this.pos.promotion_apply_9 && stackable == true) {
                            var k = 0;
                            this.pos.gui.show_popup('list_of_free_product', {});
                              if (promotion) {
                                this.by_pro_free = true;
                                var products = this.pos.promotion_product_gift_free_by_promotion_id[promotion.id];
                                var contents = $('#promotions_list_selected');
				                contents.append($(QWeb.render('list_of_free_products',{widget: self, products:products})));
				                $('.free_pro_sel').removeClass('.free_pro_sel');
				                var self = this;
                                $('.free_pro #max').change(function () {
                                    var tot_quant = 0;
                                    if(dm_free_gifts == true){
                                        $('.free_pro_sel #max').each(function() {
                                            tot_quant = tot_quant + parseInt($(this).val());
                                        });
                                        if (parseInt($(this).val()) > 0) {
                                            var maxlim = $(this).closest('.free_pro').find('#avail').attr('data-qty');
                                            if (parseInt($(this).val()) <= parseInt(maxlim)){
                                                tot_quant = parseInt($(this).val()) + tot_quant;
                                                if (tot_quant <= ff_qty){
                                                    $(this).closest('.free_pro').addClass('free_pro_sel');
                                                }
                                                else {
                                                    alert('You can select only '+ ff_qty + 'product');
                                                    $(this).val('');
                                                    tot_quant = 0;
                                                    $('.free_pro_sel #max').each(function() {
                                                        $(this).val('');
                                                        $(this).closest('.free_pro').removeClass('free_pro_sel');
                                                    });
                                                }
                                            } else {
                                                alert("You Can not select more than max limit!");
                                                $(this).val('');
                                            }
                                        }
                                    }
                                    else{
                                        $('.free_pro_sel #max').each(function() {
                                            tot_quant = tot_quant + parseInt($(this).val());
                                        });
                                        if (parseInt($(this).val()) > 0) {
                                            var maxlim = $(this).closest('.free_pro').find('#avail').attr('data-qty');
                                            if (parseInt($(this).val()) <= parseInt(maxlim)){
                                                tot_quant = parseInt($(this).val()) + tot_quant;
                                                if (tot_quant <= free_qty){
                                                    $(this).closest('.free_pro').addClass('free_pro_sel');
                                                }
                                                else {
                                                    alert('You can select only '+ free_qty + 'product');
                                                    $(this).val('');
                                                    tot_quant = 0;
                                                    $('.free_pro_sel #max').each(function() {
                                                        $(this).val('');
                                                        $(this).closest('.free_pro').removeClass('free_pro_sel');
                                                    });
                                                }
                                            } else {
                                                alert("You Can not select more than max limit!");
                                                $(this).val('');
                                            }
                                        }
                                    }
                                });
                                $('.free_prod_app').click(function(){
									/* update realtime promotion for type 8*/
									for (var m=0; m < applied_promo.length; m++){
										if (applied_promo[m].promos.type == promotion.type) {
											self.remove_promotion_lines([applied_promo[m]]);
										}
									}
                                    var sel_pros = [];
                                    $('.free_pro_sel').each(function() {
                                        var proid = $(this).attr('data-id');
                                        var pqty = parseInt($(this).find('#max').val());
                                        var res = {};
                                        res['proid'] = proid;
                                        res['pqty'] = pqty;
                                        sel_pros.push(res);
                                    });
                                    var s = 0;
                                    if (sel_pros.length == 0){
                                        self.pos.promotion_apply_9 = false;
                                        self.by_pro_free = false;
                                        return false
                                    }
                                    for(s in sel_pros){
                                        var product = self.pos.db.get_product_by_id(sel_pros[s]['proid']);
                                        var free_qty_for_gift = promotion.qty_free;
                                        if(dm_free_gifts == true){
                                            self.add_product(product, {
                                                price: 0.00,
                                                quantity: sel_pros[s]['pqty'],
                                            });
                                        }
                                        else {
                                            self.add_product(product, {
                                                price: 0.00,
                                                quantity: sel_pros[s]['pqty'],
                                            });
                                        }
                                        self.pos.promotion_apply_9 = true;
                                        self.by_pro_free = false;
                                        var selected_line = self.get_selected_orderline();
                                        selected_line.promotion_product_gift_condition = true;
                                        selected_line.promotion = true;
                                        selected_line.promos = promotion;
                                        selected_line.promotion_reason =  promotion.name;
                                        selected_line.promos = promotion;
                                        selected_line.trigger('change', selected_line);
                                        s++;
                                    }
                                    $('.free_pro_sel').removeClass('.free_pro_sel');
                                });
                            }
                            
                        } else {
                            this.by_pro_free = true;
                        }
                        j++;
                    }
                }
            }
            if(this.pos.auto_promotion_new == false){
                var j = 0;
                for (j in this.pos.promotion_product_gift_condition_by_promotion_id[promotion.id]) {
                	var promotion_line = this.pos.promotion_product_gift_condition_by_promotion_id[promotion.id][j];
                    var z = 0;
                    var method_count = false;
					var min_amt = promotion.min_amt;
					var total_order = this.get_total_without_promotion_and_tax();
					var free_pro = false;
					var ff_qty = 0;
					var dm_free_gifts = promotion.dm_free_gifts;
                    var free_qty = promotion.qty_free;
                    while (z < lines.length) {
                        if (!lines[z].product.id) {
                            z++;
                            continue;
                        }
                        /*if (lines[z].product.id == promotion_line.product_id[0] && lines[z].quantity >= promotion_line.minimum_quantity) {
							free_pro = true;
							var pr_qty = lines[z].quantity
                            if(dm_free_gifts == true){
                                ff_qty += pr_qty * free_qty

                            }
                        }*/
                        if (pro_brand_id && pro_brand_id == lines[z].product.product_brand_id[0]) {
                                if (lines[z].product.id == promotion_line.product_id[0] && lines[z].quantity >= promotion_line.minimum_quantity) {
                                    //method_count = true;
                                    free_pro = true;
                                    var pr_qty = lines[z].quantity
                                    if(dm_free_gifts == true){
                                        ff_qty += pr_qty * free_qty
                                    }
                                }
                        }
                        if (!pro_brand_id){
                            if (lines[z].product.id == promotion_line.product_id[0] && lines[z].quantity >= promotion_line.minimum_quantity) {
                                //method_count = true;
                                free_pro = true;
                                var pr_qty = lines[z].quantity
                                if(dm_free_gifts == true){
                                    ff_qty += pr_qty * free_qty
                                }
                            }
                        }//END
                        z++;
                    }
					if (free_pro && total_order >= min_amt) {
						method_count = true;
					}
                    if (method_count == true && !this.pos.promotion_apply_9) {
                        var k = 0;
                        this.pos.gui.show_popup('list_of_free_product', {});
                          if (promotion) {
                            this.by_pro_free = true;
                            var products = this.pos.promotion_product_gift_free_by_promotion_id[promotion.id];
                            var contents = $('#promotions_list_selected');
				            contents.append($(QWeb.render('list_of_free_products',{widget: self, products:products})));
				            $('.free_pro_sel').removeClass('.free_pro_sel');
				            var self = this;
                            $('.free_pro #max').change(function () {
                                var tot_quant = 0;
                                if(dm_free_gifts == true){
                                    $('.free_pro_sel #max').each(function() {
                                        tot_quant = tot_quant + parseInt($(this).val());
                                    });
                                    if (parseInt($(this).val()) > 0) {
                                        var maxlim = $(this).closest('.free_pro').find('#avail').attr('data-qty');
                                        if (parseInt($(this).val()) <= parseInt(maxlim)){
                                            tot_quant = parseInt($(this).val()) + tot_quant;
                                            if (tot_quant <= ff_qty){
                                                $(this).closest('.free_pro').addClass('free_pro_sel');
                                            }
                                            else {
                                                alert('You can select only '+ ff_qty + 'product');
                                                $(this).val('');
                                                tot_quant = 0;
                                                $('.free_pro_sel #max').each(function() {
                                                    $(this).val('');
                                                    $(this).closest('.free_pro').removeClass('free_pro_sel');
                                                });
                                            }
                                        } else {
                                            alert("You Can not select more than max limit!");
                                            $(this).val('');
                                        }
                                    }
                                }
                                else{
                                    $('.free_pro_sel #max').each(function() {
                                        tot_quant = tot_quant + parseInt($(this).val());
                                    });
                                    if (parseInt($(this).val()) > 0) {
                                        var maxlim = $(this).closest('.free_pro').find('#avail').attr('data-qty');
                                        if (parseInt($(this).val()) <= parseInt(maxlim)){
                                            tot_quant = parseInt($(this).val()) + tot_quant;
                                            if (tot_quant <= free_qty){
                                                $(this).closest('.free_pro').addClass('free_pro_sel');
                                            }
                                            else {
                                                alert('You can select only '+ free_qty + 'product');
                                                $(this).val('');
                                                tot_quant = 0;
                                                $('.free_pro_sel #max').each(function() {
                                                    $(this).val('');
                                                    $(this).closest('.free_pro').removeClass('free_pro_sel');
                                                });
                                            }
                                        } else {
                                            alert("You Can not select more than max limit!");
                                            $(this).val('');
                                        }
                                    }
                                }
                            });
                            $('.free_prod_app').click(function(){
                                var sel_pros = [];
                                $('.free_pro_sel').each(function() {
                                    var proid = $(this).attr('data-id');
                                    var pqty = parseInt($(this).find('#max').val());
                                    var res = {};
                                    res['proid'] = proid;
                                    res['pqty'] = pqty;
                                    sel_pros.push(res);
                                });
                                var s = 0;
                                if (sel_pros.length == 0){
                                    self.pos.promotion_apply_9 = false;
                                    self.by_pro_free = false;
                                    return false
                                }
                                for(s in sel_pros){
                                    var product = self.pos.db.get_product_by_id(sel_pros[s]['proid']);
                                    var free_qty_for_gift = promotion.qty_free;
                                    if(dm_free_gifts == true){
                                        self.add_product(product, {
                                            price: 0.00,
                                            quantity: sel_pros[s]['pqty'],
                                        });
                                    }
                                    else {
                                        self.add_product(product, {
                                        price: 0.00,
                                        quantity: sel_pros[s]['pqty'],
                                        });
                                    }
                                    self.pos.promotion_apply_9 = true;
                                    self.by_pro_free = false;
                                    var selected_line = self.get_selected_orderline();
                                    selected_line.promotion_product_gift_condition = true;
                                    selected_line.promotion = true;
                                    selected_line.promos = promotion;
                                    selected_line.promotion_reason =  promotion.name;
                                    selected_line.promos = promotion;
                                    selected_line.trigger('change', selected_line);
                                    s++;
                                }
                                $('.free_pro_sel').removeClass('.free_pro_sel');
                            });
                        }
                        
                    }
                    j++;
                }
            }
            
        },
        // New Added For Type = Free x from group of products
        compute_free_x_from_group_of_products: function (promotion){
            var lines = this.orderlines.models;
            var promo = this.pos.selected_promo;
            var lines_remove = [];
            var order = this.pos.get_order();
            var total = this.get_total_without_tax()
            var pro_brand_id = promotion.brand_id[0]; //Updated Based ON many2one
            var ol_qty = 0;
            var i = 0;
            var applied_promo = [];
            var l = 0;
            while (l < lines.length) {
                var line = lines[l];
                if (line.promos){
                    applied_promo.push(line);
                }
                l++;
            }
            var another_promo = false;
            for (var m=0; m < applied_promo.length; m++){
                another_promo = applied_promo[m].promos.stackable_in_promotion;
            }

            while (i < lines.length) {
                var line = lines[i];
                if ((line.promotion_discount_total_order && line.promotion_discount_total_order == true)//type1
                || (line.promotion_discount_category && line.promotion_discount_category == true)//type2
                || (line.promotion_discount_by_quantity && line.promotion_discount_by_quantity == true)//type3
                || (line.promotion_discount && line.promotion_discount == true)//type4
                || (line.promotion_gift && line.promotion_gift == true)//type5
                || (line.promotion_price_by_quantity && line.promotion_price_by_quantity == true)//type6
                || (line.promotion_brand_gift_condition && line.promotion_brand_gift_condition == true)//type 7
                || (line.promotion_product_gift_condition && line.promotion_product_gift_condition == true)//type 8
                || (line.free_gift_based_on_group_of_product && line.free_gift_based_on_group_of_product == true)//type 09
                ){
                    lines_remove.push(line)
                }
                ol_qty += line.quantity;
                i++;
            }
            if (another_promo == false && this.pos.auto_promotion_new == false){
                this.remove_promotion_lines(lines_remove);
                this.pos.promotion_apply_disc_tot = false; // type 1
                this.pos.promotion_apply_disc_cat = false; // type 2
                this.pos.promotion_apply_disc_qty = false; // type 3
                this.pos.promotion_apply_disc_prod = false; // type 4
                this.pos.promotion_apply_free_prod = false; // type 5
                this.pos.promotion_apply_filter = false; //type 6
                this.pos.promotion_apply = false;
                this.pos.promotion_apply_9 = false;
                this.pos.promotion_apply_10 = false;
            }
            if(this.pos.auto_promotion_new == true){
                if (this.pr_st && this.old_promo == false){
                    return false;
                } else {
                    var j = 0;
                    for (j in this.pos.promotion_free_gift_based_on_group_of_product_by_promotion_id[promotion.id]) {
                         var total_order = this.get_total_without_promotion_and_tax();
                         var min_amt = promotion.min_amt;
                         var quantity_line_by_product_id = this.get_product_and_quantity_current_order();
                         var promotion_line = this.pos.promotion_free_gift_based_on_group_of_product_by_promotion_id[promotion.id][j];
                         var z = 0;
                         var method_count = false;
                         var stackable = false;
                         if (this.old_promo && promotion.stackable_in_promotion){
                             stackable = true;
                         } else if(this.old_promo == false && promotion.stackable_in_promotion) {
                             stackable = true;
                         } else if(this.old_promo && promotion.stackable_in_promotion == false) {
                             stackable = false;
                         } else if(this.old_promo == false && promotion.stackable_in_promotion == false) {
                            stackable = true;
                         }
                         var pl_group_of_product_ids = this.pos.promotion_free_gift_based_on_group_of_product_by_promotion_id[promotion.id][j].product_id;
                         var orderline_products_ids = [];
                         var orderline_product_prices = 0.0;
                         var group_of_p_prices = [];
                         var group_of_id_price_list = [];
                         var id_price_dict = {}
                         var ip = 0;
                         for(ip in pl_group_of_product_ids){
                            var product = this.pos.db.get_product_by_id(pl_group_of_product_ids[ip]);
                            if (pro_brand_id && pro_brand_id == product.product_brand_id[0]) {
                                group_of_id_price_list.push(product)
                            }
                            if (!pro_brand_id){
                                group_of_id_price_list.push(product)
                            }
                            //group_of_id_price_list.push(product)
                            ip++;
                         }
                         var res = _.sortBy(group_of_id_price_list, 'price');
                         var res_e = _.sortBy(group_of_id_price_list, 'price').reverse();
                         while (z < lines.length) {
                            if (!lines[z].product.id) {
                                z++;
                                continue;
                                }
                            orderline_products_ids.push(lines[z].product.id);
                            orderline_product_prices += lines[z].product.price;
                            group_of_p_prices.push(lines[z].product.price);
                            z++;
                          }
                          var group_of_products_lst = pl_group_of_product_ids
                          var p_id = 0;
                          for (p_id in orderline_products_ids){
                                if(_.contains(pl_group_of_product_ids, orderline_products_ids[p_id])){
                                   group_of_products_lst = $.grep(group_of_products_lst, function(value) {
                                      return value != orderline_products_ids[p_id];
                                    });
                                }
                            p_id++;
                          }
                          var qty_appli = 0;
                          var pack_appli = [];
                           _.each(quantity_line_by_product_id, function(k,v) {
                                if (_.contains(pl_group_of_product_ids, parseInt(v))){
                                    qty_appli = qty_appli + parseInt(k);
                                    pack_appli.push(parseInt(v));
                                }
                            });
                          var full_pack = _.difference(pl_group_of_product_ids, pack_appli).length;
                          /*var tot_min = false;
                          if (total_order >= min_amt) {
                                tot_min = true;
                           }*/
                          if(group_of_products_lst.length == 0 && !this.pos.promotion_apply_10 && stackable == true){
                                if(qty_appli >= promotion_line.min_qty && full_pack == 0 && total >= promotion_line.min_amount){
                                    var pr_tp = promotion_line.no_of_product
                                    var tp = promotion_line.to_pay
                                    var pr_pt = this.pos.db.get_product_by_id(promotion.product_id[0]);
                                    if(tp == "most_expensive"){
                                        var exp_pro = []
                                        for(var i=0; i < pr_tp; i++){
                                            exp_pro.push(res_e[i]);
                                        }
                                        var diff = _.difference(res_e, exp_pro);

                                    }
                                    if(tp == "cheapest"){
                                        var cheap_pro = []
                                        for(var i=0; i < pr_tp; i++){
                                            cheap_pro.push(res[i]);
                                        }
                                        var diff = _.difference(res, cheap_pro);

                                    }
                                    var tot_p = 0.0;
                                    var t = 0;
                                    for(t in diff){
                                        _.each(quantity_line_by_product_id, function(k,v) {
                                            if(diff[t].id == parseInt(v)){
                                                tot_p += parseInt(k) * diff[t].price;
                                                }
                                            })
                                        //tot_p += diff[t].price;
                                    t++;
                                    }
									/* update realtime promotion for type 9*/
									for (var m=0; m < applied_promo.length; m++){
										if (applied_promo[m].promos.type == promotion.type) {
											this.remove_promotion_lines([applied_promo[m]]);
											break;
										}
									}
									if (tot_p != 0){
                                        this.add_product(pr_pt, {
                                        price: -tot_p,
                                        });
                                    }
                                    /*this.add_product(pr_pt, {
                                                price: -tot_p,
                                    });*/
                                    this.pos.promotion_apply_10 = true;
                                    this.by_free_x = false;
                                    var selected_line = this.get_selected_orderline();
                                    selected_line.free_gift_based_on_group_of_product = true;
                                    /*selected_line.promotion = true;
                                    selected_line.promos = promotion;
                                    selected_line.promotion_reason =  promotion.name;*/
                                    if (tot_p != 0){
                                        selected_line.promotion = true;
                                        selected_line.promos = promotion;
                                        selected_line.promotion_reason =  promotion.name;
                                    }
                                    selected_line.trigger('change', selected_line);
                                }

                          } else {
                             	this.by_free_x = true;
                          }
                      j++;
                    }
                }
            }
            if(this.pos.auto_promotion_new == false){
                var quantity_line_by_product_id = this.get_product_and_quantity_current_order();
                var j = 0;
                for (j in this.pos.promotion_free_gift_based_on_group_of_product_by_promotion_id[promotion.id]) {
                     var promotion_line = this.pos.promotion_free_gift_based_on_group_of_product_by_promotion_id[promotion.id][j];
                     var total_order = this.get_total_without_promotion_and_tax();
                     var min_amt = promotion.min_amt;
                     var z = 0;
                     var method_count = false;
                     var pl_group_of_product_ids = this.pos.promotion_free_gift_based_on_group_of_product_by_promotion_id[promotion.id][j].product_id;
                     var orderline_products_ids = [];
                     var orderline_product_prices = 0.0;
                     var group_of_p_prices = [];
                     var group_of_id_price_list = [];
                     var id_price_dict = {}
                     var ip = 0;
                     for(ip in pl_group_of_product_ids){
                        var product = this.pos.db.get_product_by_id(pl_group_of_product_ids[ip]);
                        if (pro_brand_id && pro_brand_id == product.product_brand_id[0]) {
                            group_of_id_price_list.push(product)
                        }
                        if (!pro_brand_id){
                            group_of_id_price_list.push(product)
                        }
                        //group_of_id_price_list.push(product)
                        ip++;
                     }
                     var res = _.sortBy(group_of_id_price_list, 'price');
                     var res_e = _.sortBy(group_of_id_price_list, 'price').reverse();
                     while (z < lines.length) {
                        if (!lines[z].product.id) {
                            z++;
                            continue;
                            }
                        orderline_products_ids.push(lines[z].product.id);
                        orderline_product_prices += lines[z].product.price;
                        group_of_p_prices.push(lines[z].product.price);
                        z++;
                      }
                      var group_of_products_lst = pl_group_of_product_ids
                      var p_id = 0;
                      for (p_id in orderline_products_ids){
                            if(_.contains(pl_group_of_product_ids, orderline_products_ids[p_id])){
                               group_of_products_lst = $.grep(group_of_products_lst, function(value) {
                                  return value != orderline_products_ids[p_id];
                                });
                            }
                        p_id++;
                      }
                     var qty_appli = 0;
                     var pack_appli = [];
                      _.each(quantity_line_by_product_id, function(k,v) {
                            if (_.contains(pl_group_of_product_ids, parseInt(v))){
                                qty_appli = qty_appli + parseInt(k);
                                pack_appli.push(parseInt(v));
                            }
                        });
                      var full_pack = _.difference(pl_group_of_product_ids, pack_appli).length;
                      if(group_of_products_lst.length == 0 && !this.pos.promotion_apply_10 && group_of_id_price_list && group_of_id_price_list.length){
                            if(qty_appli >= promotion_line.min_qty && full_pack == 0 && total >= promotion_line.min_amount){
                                var pr_tp = promotion_line.no_of_product
                                var tp = promotion_line.to_pay
                                var pr_pt = this.pos.db.get_product_by_id(promotion.product_id[0]);
                                if(tp == "most_expensive"){
                                    var exp_pro = []
                                    for(var i=0; i < pr_tp; i++){
                                        exp_pro.push(res_e[i]);
                                    }
                                    var diff = _.difference(res_e, exp_pro);

                                }
                                if(tp == "cheapest"){
                                    var cheap_pro = []
                                    for(var i=0; i < pr_tp; i++){
                                        cheap_pro.push(res[i]);
                                    }
                                    var diff = _.difference(res, cheap_pro);

                                }
                                var tot_p = 0.0;
                                var t = 0;
                                for(t in diff){
                                    _.each(quantity_line_by_product_id, function(k,v) {
                                        if(diff[t].id == parseInt(v)){
                                            tot_p += parseInt(k) * diff[t].price;
                                        }
                                    })
                                    //tot_p += diff[t].price;
                                t++;
                                }
                                if (tot_p != 0){
                                    this.add_product(pr_pt, {
                                    price: -tot_p,
                                    });
                                }
                                this.pos.promotion_apply_10 = true;
                                this.by_free_x = false;
                                var selected_line = this.get_selected_orderline();
                                selected_line.free_gift_based_on_group_of_product = true;
                                if (tot_p != 0){
                                    selected_line.promotion = true;
                                    selected_line.promos = promotion;
                                    selected_line.promotion_reason =  promotion.name;
                                }
                                selected_line.trigger('change', selected_line);
                            }

                      }
                  j++;
                }
            }

        },


    });


    //------- *** Screen of promotions *** ---------------//
    var full_promotion_button = screens.ActionButtonWidget.extend({
		template: 'full_promotion_button',
		button_click: function () {
			var order = this.pos.get_order();
			var OrderLines = order.orderlines;

            var self = this;
            self.promotions = [];
            this.pos.promotions.forEach(function (item) {
                if(item.start_date){
                    if(item.start_date)var start_time = new Date(item.start_date).getTime();
                    if(item.end_date)var end_time = new Date(item.end_date).getTime();
                    var current_time = new Date().getTime();
                    if(!item.start_date || start_time < current_time){
                        if (!item.end_date || current_time < end_time){
                            if(item.week_days_ids.length == 0 || self.promo_check_in_days(item.week_days_ids)){
                                if(!item.hours || self.promo_check_in_hours(item.hours)){
                                    self.promotions.push(item); 
                                }
                            }
                        }
                    }
                }
            });

			var promotions_show = self.promotions; //this.pos.promotions;
			var self = this;
			var prmo_ids = [];
			var exception_promotion = [];
			var orderline_product_line = [];
			this.pos.selected_promo = false;
			OrderLines.forEach( function(orderline){
				orderline_product_line.push(orderline.product.id)
			});
            var stackable_promos = [];
			this.pr_applied = false;
			//var final_promotions = this.checking_buyer(exception_promotion);
			this.promotions = this.checking_promotion(promotions_show);
            var Current_Promotions = this.promotions;
			var pt_lines = OrderLines.models;
			pt_lines.forEach( function(pt_line){
			    if(pt_line.promos){
			        if (pt_line.promos.stackable_in_promotion == true){
			            self.pr_applied = true;
			        }
			    }
			});
			Current_Promotions.forEach( function(promo_line){
			    if(promo_line.stackable_in_promotion == true)
			    {
			        stackable_promos.push(promo_line)
			    }
			});            
			if (order && order.orderlines.length) {
				this.pos.gui.show_popup('full_promotion_popup', {});
				this.pos.auto_promotion_new = false;
                $('.auto-promotion-new').removeClass('highlight');
				var contents = $('#promotions_list');
                if (self.pr_applied == true){
				    contents.append($(QWeb.render('list_of_promo',{widget: this, promotions:stackable_promos})));
				}
				else{
				    contents.append($(QWeb.render('list_of_promo',{widget: this, promotions:this.promotions})));
				}
				//contents.append($(QWeb.render('list_of_promo',{widget: this, promotions:this.promotions})));
				$('.promotion-line').click(function () {
					var promotion_id = parseInt($(this).data()['id']);
					var promotion = self.pos.promotion_by_id[promotion_id];
					self.pos.selected_promo = promotion;
					var type = promotion.type;
					var order = self.pos.get('selectedOrder');
					var partner_id = null;
					if(order.get_client()){
					    partner_id = order.get_client();
					}
					if (order.orderlines.length) {
					    if (type == '1_discount_total_order') {
					        if (partner_id && promotion.otp_validation) {
                                new Model("customer.otp.data").call("send_mail_with_otp",[partner_id]).then(function (res) {
                                    if(res){
                                        self.gui.show_popup('customer_opt_validation', {});
                                        $('.otp_apply').click(function(){
                                            var partner_otp = $('#client_otp').val();
                                            new Model("customer.otp.data").call("check_otp",[partner_id,partner_otp]).then(function (res) {
                                                if(res){
                                                    order.compute_discount_total_order_fpp(promotion);
                                                    self.gui.close_popup();
                                                } else {
                                                    alert("OTP Does not Match!");
                                                }
                                            });
                                        });

                                    }
                                });
                            } else {
                                order.compute_discount_total_order_fpp(promotion);
                                self.gui.close_popup();
                            }
					    }
					    if (type == '2_discount_category') {
					        if (partner_id && promotion.otp_validation) {
                                new Model("customer.otp.data").call("send_mail_with_otp",[partner_id]).then(function (res) {
                                    if(res){
                                        self.gui.show_popup('customer_opt_validation', {});
                                        $('.otp_apply').click(function(){
                                            var partner_otp = $('#client_otp').val();
                                            new Model("customer.otp.data").call("check_otp",[partner_id,partner_otp]).then(function (res) {
                                                if(res){
                                                    order.compute_discount_category_fpp(promotion);
					                                self.gui.close_popup();
                                                } else {
                                                    alert("OTP Does not Match!");
                                                }
                                            });
                                        });

                                    }
                                });
                            } else {
                                order.compute_discount_category_fpp(promotion);
					            self.gui.close_popup();
                            }
//					        order.compute_discount_category_fpp(promotion);
//					        self.gui.close_popup();
					    }
					    if (type == '3_discount_by_quantity_of_product') {
					        if (partner_id && promotion.otp_validation) {
                                new Model("customer.otp.data").call("send_mail_with_otp",[partner_id]).then(function (res) {
                                    if(res){
                                        self.gui.show_popup('customer_opt_validation', {});
                                        $('.otp_apply').click(function(){
                                            var partner_otp = $('#client_otp').val();
                                            new Model("customer.otp.data").call("check_otp",[partner_id,partner_otp]).then(function (res) {
                                                if(res){
                                                    order.compute_discount_by_quantity_of_products_fpp(promotion);
					                                self.gui.close_popup();
                                                } else {
                                                    alert("OTP Does not Match!");
                                                }
                                            });
                                        });

                                    }
                                });
                            } else {
                                order.compute_discount_by_quantity_of_products_fpp(promotion);
					            self.gui.close_popup();
                            }
//					        order.compute_discount_by_quantity_of_products_fpp(promotion);
//					        self.gui.close_popup();
					    }
					    if (type == '4_pack_discount') {
					        if (partner_id && promotion.otp_validation) {
                                new Model("customer.otp.data").call("send_mail_with_otp",[partner_id]).then(function (res) {
                                    if(res){
                                        self.gui.show_popup('customer_opt_validation', {});
                                        $('.otp_apply').click(function(){
                                            var partner_otp = $('#client_otp').val();
                                            new Model("customer.otp.data").call("check_otp",[partner_id,partner_otp]).then(function (res) {
                                                if(res){
                                                    order.compute_pack_discount_fpp(promotion);
					                                self.gui.close_popup();
                                                } else {
                                                    alert("OTP Does not Match!");
                                                }
                                            });
                                        });

                                    }
                                });
                            } else {
                                order.compute_pack_discount_fpp(promotion);
					            self.gui.close_popup();
                            }
//					        order.compute_pack_discount_fpp(promotion);
//					        self.gui.close_popup();
					    }
					    if (type == '5_pack_free_gift') {
					        if (partner_id && promotion.otp_validation) {
                                new Model("customer.otp.data").call("send_mail_with_otp",[partner_id]).then(function (res) {
                                    if(res){
                                        self.gui.show_popup('customer_opt_validation', {});
                                        $('.otp_apply').click(function(){
                                            var partner_otp = $('#client_otp').val();
                                            new Model("customer.otp.data").call("check_otp",[partner_id,partner_otp]).then(function (res) {
                                                if(res){
                                                    order.compute_pack_free_gift_fpp(promotion);
					                                self.gui.close_popup();
                                                } else {
                                                    alert("OTP Does not Match!");
                                                }
                                            });
                                        });

                                    }
                                });
                            } else {
                                order.compute_pack_free_gift_fpp(promotion);
					            self.gui.close_popup();
                            }
//					        order.compute_pack_free_gift_fpp(promotion);
//					        self.gui.close_popup();
					    }
					    if (type == '6_price_filter_quantity') {
					        if (partner_id && promotion.otp_validation) {
                                new Model("customer.otp.data").call("send_mail_with_otp",[partner_id]).then(function (res) {
                                    if(res){
                                        self.gui.show_popup('customer_opt_validation', {});
                                        $('.otp_apply').click(function(){
                                            var partner_otp = $('#client_otp').val();
                                            new Model("customer.otp.data").call("check_otp",[partner_id,partner_otp]).then(function (res) {
                                                if(res){
                                                    order.compute_price_filter_quantity_fpp(promotion);
					                                self.gui.close_popup();
                                                } else {
                                                    alert("OTP Does not Match!");
                                                }
                                            });
                                        });

                                    }
                                });
                            } else {
                                order.compute_price_filter_quantity_fpp(promotion);
					            self.gui.close_popup();
                            }
//					        order.compute_price_filter_quantity_fpp(promotion);
//					        self.gui.close_popup();
					    }
				    	if (type == '8_brand_product_pos') {
				    	    if (partner_id && promotion.otp_validation) {
                                new Model("customer.otp.data").call("send_mail_with_otp",[partner_id]).then(function (res) {
                                    if(res){
                                        self.gui.show_popup('customer_opt_validation', {});
                                        $('.otp_apply').click(function(){
                                            var partner_otp = $('#client_otp').val();
                                            new Model("customer.otp.data").call("check_otp",[partner_id,partner_otp]).then(function (res) {
                                                if(res){
                                                    order.compute_brand_product_pos(promotion);
				    		                        self.gui.close_popup();
                                                } else {
                                                    alert("OTP Does not Match!");
                                                }
                                            });
                                        });

                                    }
                                });
                            } else {
                                order.compute_brand_product_pos(promotion);
				    		    self.gui.close_popup();
                            }
//				    		order.compute_brand_product_pos(promotion);
//				    		self.gui.close_popup();
				    	}
				    	if (type == '9_product_product_pos') {
				    	    if (partner_id && promotion.otp_validation) {
                                new Model("customer.otp.data").call("send_mail_with_otp",[partner_id]).then(function (res) {
                                    if(res){
                                        self.gui.show_popup('customer_opt_validation', {});
                                        $('.otp_apply').click(function(){
                                            var partner_otp = $('#client_otp').val();
                                            new Model("customer.otp.data").call("check_otp",[partner_id,partner_otp]).then(function (res) {
                                                if(res){
                                                    order.compute_product_product_pos(promotion);
                                                } else {
                                                    alert("OTP Does not Match!");
                                                }
                                            });
                                        });

                                    }
                                });
                            } else {
                                order.compute_product_product_pos(promotion);
                            }
//				    		order.compute_product_product_pos(promotion);
				    	}
				    	if (type == '10_free_x_from_group_of_product') {
				    	    if (partner_id && promotion.otp_validation) {
                                new Model("customer.otp.data").call("send_mail_with_otp",[partner_id]).then(function (res) {
                                    if(res){
                                        self.gui.show_popup('customer_opt_validation', {});
                                        $('.otp_apply').click(function(){
                                            var partner_otp = $('#client_otp').val();
                                            new Model("customer.otp.data").call("check_otp",[partner_id,partner_otp]).then(function (res) {
                                                if(res){
                                                    order.compute_free_x_from_group_of_products(promotion);
				    		                        self.gui.close_popup();
                                                } else {
                                                    alert("OTP Does not Match!");
                                                }
                                            });
                                        });

                                    }
                                });
                            } else {
                                order.compute_free_x_from_group_of_products(promotion);
				    		    self.gui.close_popup();
                            }
//				    		order.compute_free_x_from_group_of_products(promotion);
//				    		self.gui.close_popup();
				    	}
					}

				});

				$('.remove_promotion').click(function () {
				    var order = self.pos.get('selectedOrder');
				    var lines = order.orderlines.models;
				    var lines_remove = [];
				    var i = 0;
				    while (i < lines.length) {
				        var line = lines[i];
				        if (line.promotion && line.promotion == true) {
				            lines_remove.push(line)
				        }
				        i++;
				    }
				    order.remove_promotion_lines(lines_remove)
				    order.trigger('change', order);
                    self.pr_applied = false;
					self.gui.close_popup();
				});

			}
		},
		checking_promotion: function(promotions) {
			var self = this;
			var order = this.pos.get_order();
			var final_prom = [];
			if (promotions){
				for (var prom in promotions){
					if (promotions[prom].type != '8_brand_product_pos' || promotions[prom].type != '9_product_product_pos' || promotions[prom].type != '10_free_x_from_group_of_product'){
						final_prom.push(promotions[prom]);
					}
				}
			}
			return final_prom;
		},
        promo_check_in_days: function (array_ids) {
            var self = this;
            var d = new Date();
            var weekday = new Array(7);
            weekday[0] = "Sunday";
            weekday[1] = "Monday";
            weekday[2] = "Tuesday";
            weekday[3] = "Wednesday";
            weekday[4] = "Thursday";
            weekday[5] = "Friday";
            weekday[6] = "Saturday";
            var result = false;
            var day = weekday[d.getDay()];
            array_ids.forEach(function (item) {
                if(self.pos.db.pos_promotion_days_by_id[item] && self.pos.db.pos_promotion_days_by_id[item].name == day){
                    result = true;
                }
            });
            return result
        },
        promo_check_in_hours: function (string) {
            var period = string.split(',');
            var result = false;
            period.forEach(function (item) {
                var hours = item.trim().split('-');
                var current_hour = new Date().getHours();
                if(parseInt(hours[0]) <= current_hour <= parseInt(hours[1])){
                    result = true;
                }
            });
            return result;
        },
	});

	screens.define_action_button({
		'name': 'full_promotion_button',
		'widget': full_promotion_button,
		'condition': function () {
			return this.pos.config.promotion_ids.length && this.pos.config.allow_promotion == true;
		},
	});

    PaymentScreenWidget.include({
        click_paymentmethods: function(id) {
            var cashregister = null;
            for ( var i = 0; i < this.pos.cashregisters.length; i++ ) {
                if (this.pos.get_order().pos.promotions.length > 0){
                    if (this.pos.selected_promo && this.pos.selected_promo.is_payment_mehod && !this.pos.selected_promo.payment_method_id.includes(id))
                    {
                        this.gui.show_popup('error',{
                        'title': _t('Journal Not Matched'),
                        'body':  _t('you can not pay by this payment method for this promotion.'),
                    });
                        return false;
                    }
                }
                if ( this.pos.cashregisters[i].journal_id[0] === id ){
                    cashregister = this.pos.cashregisters[i];
                    break;
                }
            }
            this.pos.get_order().add_paymentline( cashregister );
            this.reset_input();
            this.render_paymentlines();
        },
    });
    
	var full_promotion_popup = PopupWidget.extend({ 
	 	template: 'full_promotion_popup', 
	 	init: function (parent, options) { 
	 		this._super(parent, options); 
	 		this.promotions = this.pos.promotions; 
	 	},
	 	renderElement: function () {
	 		var promotions_cache = this.pos.promotions;
            
            this._super();
            var self = this;
	 	},
	 	
	 });
	
	 gui.define_popup({ name: 'full_promotion_popup', widget: full_promotion_popup });

    // For Popup of by products free products
    var list_of_free_product = PopupWidget.extend({
        template: 'list_of_free_product',
        init: function (parent, options) {
            this._super(parent, options);
            this.promotions = this.pos.promotions;
        },
        renderElement: function () {
            var promotions_cache = this.pos.promotions;
            var self = this;
            var order = this.pos.get_order();
            this._super();
        }
    });
    gui.define_popup({
        name: 'list_of_free_product',
        widget: list_of_free_product
    });

    //for customer OTP generation

     // For Popup of by products free products
    var customer_opt_validation = PopupWidget.extend({
        template: 'customer_opt_validation',
        init: function (parent, options) {
            this._super(parent, options);
//            this.promotions = this.pos.promotions;
        },
        renderElement: function () {
//            var promotions_cache = this.pos.promotions;
            var self = this;
            var order = this.pos.get_order();
            this._super();
        }
    });
    gui.define_popup({
        name: 'customer_opt_validation',
        widget: customer_opt_validation
    });

    // For Popup of Flexible by products free products
    /*var list_of_free_product_flexi = PopupWidget.extend({
        template: 'list_of_free_product_flexi',
        init: function (parent, options) {
            this._super(parent, options);
            this.promotions = this.pos.promotions;
        },
        renderElement: function () {
            var promotions_cache = this.pos.promotions;
            var self = this;
            var order = this.pos.get_order();
            this._super();
        }
    });
    gui.define_popup({
        name: 'list_of_free_product_flexi',
        widget: list_of_free_product_flexi
    });*/


    /*new added button for auto promotion*/
    var auto_promotion_button_new = screens.ActionButtonWidget.extend({
    	template: 'auto_promotion_button_new',
    	button_click: function () {
    	    // keep old values to get again when pin not match
            var promotion_apply_disc_tot = this.pos.promotion_apply_disc_tot; //type 1
            var promotion_apply_disc_cat = this.pos.promotion_apply_disc_cat; //type 2
            var promotion_apply_disc_qty = this.pos.promotion_apply_disc_qty; //type 3
            var promotion_apply_disc_prod = this.pos.promotion_apply_disc_prod; //type 4
            var promotion_apply_free_prod = this.pos.promotion_apply_free_prod; //type 5
            var promotion_apply_filter = this.pos.promotion_apply_filter; //type 6
            var promotion_apply = this.pos.promotion_apply;
            var promotion_apply_9 = this.pos.promotion_apply_9;
            var promotion_apply_10 = this.pos.promotion_apply_10;

			this.pos.promotion_apply_disc_tot = false; //type 1
            this.pos.promotion_apply_disc_cat = false; //type 2
            this.pos.promotion_apply_disc_qty = false; //type 3
            this.pos.promotion_apply_disc_prod = false; //type 4
            this.pos.promotion_apply_free_prod = false; //type 5
            this.pos.promotion_apply_filter = false; //type 6
            this.pos.promotion_apply = false;
            this.pos.promotion_apply_9 = false;
            this.pos.promotion_apply_10 = false;
			var auto = this.pos.auto_promotion_new;
			var order = this.pos.get_order();
			var branch_id = this.pos.config.branch_id[0];
            var approver_id = this.pos.branch_by_id[branch_id]['approver_id'];
            var self = this;
            if (auto == false || !auto) {
                if(branch_id && approver_id){
                    var current_user_id = this.pos.user.id;
                    if (current_user_id == approver_id[0]){
                        this.gui.show_popup('auto_pin_validation', {});
                        $('.auto_pin_apply').click(function(){
                            var user_pin = $('#auto_pin').val();
                            new Model("res.users").call("check_promotion_pin",[current_user_id,user_pin]).then(function (res) {
                                if(res){
                                    self.pos.auto_promotion_new = true;
                                    $('.auto-promotion-new').addClass('highlight');
                                    self.gui.close_popup();
                                } else {
                                    alert("OTP Does not Match!");
                                }
                            });
                        });
                    }
                }
                else{
                    alert("Set Approver in  Branch and add promotion pin in users Configuration");

                }
            } else {
                    self.pos.auto_promotion_new = false;
                    // keep old values to get again when pin not match
                    var by_pro_free = this.by_pro_free;
                    var disc_tot = this.disc_tot;
                    var disc_cat = this.disc_cat;
                    var disc_qty =  this.disc_qty;
                    var pp_disc = this.pp_disc;
                    var pp_free = this.pp_free;
                    var ppf_qty = this.ppf_qty;
                    var by_free_x = this.by_free_x;
                    var by_brand = this.by_brand;

                    this.by_pro_free = false; //type 8
                    this.disc_tot = false; //type 1
                    this.disc_cat = false; //type 2
                    this.disc_qty = false; //type 3
                    this.pp_disc = false; //type 4
                    this.pp_free = false; //type 5
                    this.ppf_qty = false; // type 6
                    this.by_free_x = false; // type 9
                    this.by_brand = false; // type 7
                    var restrt = false;
                    var current_user_id = this.pos.user.id;
                    if (current_user_id == approver_id[0]){
                        this.gui.show_popup('auto_pin_validation', {});
                        $('.auto_pin_apply').click(function(){
                            var user_pin = $('#auto_pin').val();
                            new Model("res.users").call("check_promotion_pin",[current_user_id,user_pin]).then(function (res) {
                                if(res){
                                    self.pos.auto_promotion_new = false;
                                    $('.auto-promotion-new').removeClass('highlight');
                                    self.gui.close_popup();
                                } else {
                                    alert("OTP Does not Match!");
                                    restrt = true;
                                }

                                if (restrt) {
                                    self.pos.auto_promotion_new = true;
                                    if (promotion_apply_disc_tot) {
                                        self.pos.promotion_apply_disc_tot = true;
                                    }
                                    if (promotion_apply_disc_cat) {
                                        self.pos.promotion_apply_disc_cat = true;
                                    }
                                    if (promotion_apply_disc_qty) {
                                        self.pos.promotion_apply_disc_qty = true;
                                    }
                                    if (promotion_apply_disc_prod) {
                                        self.pos.promotion_apply_disc_prod = true;
                                    }
                                    if (promotion_apply_free_prod) {
                                        self.pos.promotion_apply_free_prod = true;
                                    }
                                    if (promotion_apply_filter) {
                                        self.pos.promotion_apply_filter = true;
                                    }
                                    if(promotion_apply) {
                                        self.pos.promotion_apply = true;
                                    }
                                    if (promotion_apply_9) {
                                        self.pos.promotion_apply_9 = true;
                                    }
                                    if (promotion_apply_10) {
                                        self.pos.promotion_apply_10 = true;
                                    }

                                    if (by_pro_free) {
                                        this.by_pro_free = true; //type 8
                                    }
                                    if (disc_tot) {
                                        this.disc_tot = true; //type 1
                                    }
                                    if (disc_cat) {
                                        this.disc_cat = true; //type 2
                                    }
                                    if (disc_qty) {
                                        this.disc_qty = true; //type 3
                                    }
                                    if (pp_disc) {
                                        this.pp_disc = true; //type 4
                                    }
                                    if (pp_free) {
                                        this.pp_free = true; //type 5
                                    }
                                    if (ppf_qty) {
                                        this.ppf_qty = true; // type 6
                                    }
                                    if (by_free_x) {
                                        this.by_free_x = true; // type 9
                                    }
                                    if (by_brand) {
                                        this.by_brand = true; // type 7
                                    }
                                }
                            });
                        });
                    }
            }

		},
    });
    screens.define_action_button({
		'name': 'auto_promotion_button_new',
		'widget': auto_promotion_button_new,
		'condition': function () {
			return this.pos.config.promotion_ids.length && this.pos.config.allow_promotion == true;
		},
	});

    //For Pos pin validation in Auto promotion
    var auto_pin_validation = PopupWidget.extend({
        template: 'auto_pin_validation',
        init: function (parent, options) {
            this._super(parent, options);
//            this.promotions = this.pos.promotions;
        },
        renderElement: function () {
//            var promotions_cache = this.pos.promotions;
            var self = this;
            var order = this.pos.get_order();
            this._super();
        }
    });
    gui.define_popup({
        name: 'auto_pin_validation',
        widget: auto_pin_validation
    });


	screens.ActionpadWidget.include({
        renderElement: function () {
            var self = this;
            this._super();
            this.$('.pay').click(function () {
                self.pos.auto_promotion_new = false;
                $('.auto-promotion-new').removeClass('highlight');
				var order = self.pos.get_order();
		        var has_valid_product_lot = _.every(order.orderlines.models, function(line){
		            return line.has_valid_product_lot();
		        });
		        if(!has_valid_product_lot){
		            self.gui.show_popup('confirm',{
		                'title': _t('Empty Serial/Lot Number'),
		                'body':  _t('One or more product(s) required serial/lot number.'),
		                confirm: function(){
		                    self.gui.show_screen('payment');
		                },
		            });
		        }else{
		            self.gui.show_screen('payment');
		        }
            });
			this.$('.set-customer').click(function(){
		        self.gui.show_screen('clientlist');
		    });
        },
    })
    
});

