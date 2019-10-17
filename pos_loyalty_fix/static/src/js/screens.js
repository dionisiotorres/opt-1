odoo.define('loyality_point_history.screens', function(require) {
    "use strict";

    var ajax = require('web.ajax');
    var core = require('web.core');
    var screens = require('point_of_sale.screens');
    var Models = require('point_of_sale.models');
    var QWeb = core.qweb;
    var _t = core._t;


    screens.ClientListScreenWidget.include({
        edit_client_details: function(partner) {
            var self = this;
            partner.eligible_mem_types = self.pos.pos_mem_types;
            partner.applicable_loyalties = self.pos.pos_loyalties;
            self._super(partner);
        },
        display_client_details: function(visibility, partner, clickpos) {
            var self = this;
            if (partner) {
                partner.eligible_mem_types = self.pos.pos_mem_types;
                partner.applicable_loyalties = self.pos.pos_loyalties;
            }
            self._super(visibility, partner, clickpos);
            //Added by GYB
            $('#btn_member').click(function() {
                $('#product_data_div').css('display', 'initial');
                $('#ms_type_div').css('display', 'none');
            });
            $('#ok_member').click(function() {
                self.pos.get_order().set_client(partner);

                var lp_pro_id = $('#id_product').val();
                ajax.jsonRpc("/get_loyalty_product", 'call', {'lp_pro_id': lp_pro_id}).then(function(res) {
                    var product = self.pos.db.get_product_by_id(res['ic_join_product_id']);
                    var incur_cost = res['ic_join_cost'];
                    product['list_price'] = incur_cost;
                    product['price'] = incur_cost;
                    var order = self.pos.get_order();
                    order.changed['loyalty_id'] = res['loyalty_program_id'];

                    if (product) {
                        order.add_product(product);
                    }
                    self.gui.back();
                });
            });

            $('#btn_upgrade').click(function() {
//                $('#product_data_upg_div').css('display', 'initial');
                $('#ms_type_div').css('display', 'none');
                $('#product_data_div').css('display', 'initial');
            });
            //Added by GYB-Done
        },
        save_client_details: function(partner) {
            var self = this;
            // MEMBERSHIP NO VALIDATION
            var fields = {};
            this.$('.client-details-contents .detail').each(function(idx, el) {
                fields[el.name] = el.value || false;
            });
            // if (fields.mem_no){
            //     var mem_no_partner = self.pos.db.partner_by_mem_no[fields.mem_no];
            //     if (mem_no_partner && partner && partner.id != mem_no_partner.id){
            //         this.gui.show_popup('error',_t('Exist partner with same Membership No.'));
            //         return;
            //     }
            // }
            if ($('.reward_applicable').is(':checked')) {
                $('.reward_applicable').attr('value', true);
            } else {
                $('.reward_applicable').attr('value', "");
                $('.reward_applicable').attr('value', "");
            }
            self._super(partner);
        }
    });
});