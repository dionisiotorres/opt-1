odoo.define('labor_manufacturing_view.machine_kiosk_mode', function (require) {
"use strict";

var core = require('web.core');
var Model = require('web.Model');
var Widget = require('web.Widget');
var Session = require('web.session');
var BarcodeHandlerMixin = require('barcodes.BarcodeHandlerMixin');
var ListView = require('web.ListView');

var QWeb = core.qweb;
var _t = core._t;


ListView.List.extend({
    row_clicked: function (e, view) {
        var self = this;
        this._super.apply(this, arguments);
        var $target = $(e.currentTarget);
        var $row = $target.closest('tr');
        var record_id = self.row_id($row);
        var emp = false;
        if (this.dataset.domain && (this.dataset.domain).length > 0){
            emp = this.dataset.domain[0][2];
        }

        if ($('.o_sub_menu_content li.active > a').attr('data-menu-name') == 'Machine KIOSK mode'){
            var emp_dept = new Model('employee.department');
            emp_dept.query(['work_started','employee_id'])
               .filter([['machine_id', '=', record_id]])
               .all()
               .then(function (res){
                    var i;
                    var curr_emp_start = false;
                    for (i = 0; i < res.length; i++) {
                        if (res[i]['employee_id'][0] == emp){
                            curr_emp_start = res[i]['work_started'];
                        }
                    }
                    // if (res.length > 0) {
                        var action = {
                            type: 'ir.actions.client',
                            name: 'Confirm',
                            tag: 'machine_kiosk_mode',
                            mo_record: record_id,
                            emp_machine: emp,
                            e_start: curr_emp_start,
                        };
                        self.view.do_action(action);
                    // }
               });

        } else {
            $(this).trigger(
                'row_link',
                [this.dataset.ids[this.dataset.index],
                this.dataset, view]);
        }
    },
})


var MachineKioskMode = Widget.extend(BarcodeHandlerMixin, {
    events: {
        "click .o_machine_botton_start_work": 'start_work',
        "click .o_machine_botton_end_work": 'end_work',
    },

    init: function (parent, action) {
        // Note: BarcodeHandlerMixin.init calls this._super.init, so there's no need to do it here.
        // Yet, "_super" must be present in a function for the class mechanism to replace it with the actual parent method.
        this._super;
        BarcodeHandlerMixin.init.apply(this, arguments);
        this.mo_record = action.mo_record;
        this.estart = action.e_start;
        this.emp_machine = action.emp_machine;
    },

    start: function () {
        var self = this;
        self.session = Session;
        var res_company = new Model('res.company');
        res_company.query(['name'])
           .filter([['id', '=', self.session.company_id]])
           .all()
           .then(function (companies){
                self.company_name = companies[0].name;
                self.company_image_url = self.session.url('/web/image', {model: 'res.company', id: self.session.company_id, field: 'logo',})
                self.$el.html(QWeb.render("MachineKioskModeStart", {widget: self}));
            });
        // Make a RPC call every day to keep the session alive
        self._interval = window.setInterval(this._callServer.bind(this), (60*60*1000*24));
        return self._super.apply(this, arguments);
    },

    on_barcode_scanned: function() {
        var self = this;
        var machine_management = new Model('machine.management');
        var mo_active = self.mo_record;
        var emp_active = self.emp_machine;

        machine_management.call('update_work', [mo_active, emp_active,])
            .then(function (result) {
                if (result.action) {
                    self.do_action(result.action);
                }
            });
    },

    start_work: function() {
        var self = this;
        var machine_management = new Model('machine.management');
        var mo_active = self.mo_record;
        var emp_active = self.emp_machine;

        machine_management.call('update_work', [mo_active, emp_active, 'start',])
            .then(function (result) {
                if (result.action) {
                    self.do_action(result.action);

                }
            });
    },
    end_work: function() {
        var self = this;
        var machine_management = new Model('machine.management');
        var mo_active = self.mo_record;
        var emp_active = self.emp_machine;

        machine_management.call('update_work', [mo_active, emp_active, 'stop'])
            .then(function (result) {
                if (result.action) {
                    self.do_action(result.action);
                }
            });
     },

    destroy: function () {
        clearInterval(this.clock_start);
        clearInterval(this._interval);
        this._super.apply(this, arguments);
    },

    _callServer: function () {
        // Make a call to the database to avoid the auto close of the session
        return Session.rpc('/web/webclient/version_info', {})
    },

});

core.action_registry.add('machine_kiosk_mode', MachineKioskMode);

return MachineKioskMode;

});
