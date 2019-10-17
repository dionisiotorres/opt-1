odoo.define('loyality_point_history.db', function (require) {
"use strict";

    var PosDB = require('point_of_sale.DB');

    var core = require('web.core');
    var _t = core._t;

    PosDB.include({
        init: function (options) {
            this.partner_by_mem_no = {};
            this._super(options);
        },
        add_partners: function(partners){
            var updated_count = this._super(partners);
            if (updated_count) {
                this.partner_by_mem_no = {};
                for (var id in this.partner_by_id) {
                    var partner = this.partner_by_id[id];
                    if(partner.mem_no){
                        this.partner_by_mem_no[partner.mem_no] = partner;
                    }
                }
            }
            return updated_count;
        },
        get_partner_by_mem_no: function(mem_no){
            return this.partner_by_mem_no[mem_no];
        },
    });
    return PosDB;
});
