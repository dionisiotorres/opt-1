odoo.define('labor_manufacturing_view.labor_manufacturing', function (require) {
"use strict";

var core = require('web.core');
var Model = require('web.Model');
var Widget = require('web.Widget');
var Session = require('web.session');
var KanbanRecord = require('web_kanban.Record');
var KioskConfirm = require('hr_attendance.kiosk_confirm');

var QWeb = core.qweb;
var _t = core._t;

KanbanRecord.include({
    on_card_clicked: function() {
        if ($('.o_sub_menu_content li.active > a').attr('data-menu-name') == 'Profile'){
            if (this.model === 'hr.employee' && this.$el.parents('.o_hr_employee_attendance_kanban').length) {
                var action = {
                    type: 'ir.actions.act_window',
                    name: 'Profile',
                    res_model: 'labor.mrp',
	                view_mode:'tree,form',
	                view_type:'form',
                    domain: [['employee_id', '=', this.record.id.raw_value]],
                    res_id: this.record.id.raw_value,
                    views: [[false,'list'],[false, 'form']],
                    target: 'current'
                };
                this.do_action(action);
            } else {
                this._super.apply(this, arguments);
            }
        }
        else if ($('.o_sub_menu_content li.active > a').attr('data-menu-name') == 'Machine KIOSK mode'){
            if (this.model === 'hr.employee' && this.$el.parents('.o_hr_employee_attendance_kanban').length) {

                var action = {
                    type: 'ir.actions.act_window',
                    name: 'Machine Management',
                    res_model: 'machine.management',
	                view_mode:'tree,form',
	                view_type:'form',
	                domain: [['assigned_emp_ids.employee_id', '=', this.record.id.raw_value]],
                    res_id: this.record.id.raw_value,
                    views: [[false,'list'],[false, 'form']],
                    target: 'current'
                };
                this.do_action(action);
            }
            else {
                this._super.apply(this, arguments);
            }
        }
         else {
            if (this.model === 'hr.employee' && this.$el.parents('.o_hr_employee_attendance_kanban').length) {
                var action = {
                    type: 'ir.actions.client',
                    name: 'Confirm',
                    tag: 'hr_attendance_kiosk_confirm',
                    employee_id: this.record.id.raw_value,
                    employee_name: this.record.name.raw_value,
                    employee_state: this.record.attendance_state.raw_value,
                };
                this.do_action(action);
            } else {
                this._super.apply(this, arguments);
            }
        }
    }
});

KioskConfirm.include({
    events: {
        "click .o_hr_attendance_back_button": function () { this.do_action(this.next_action, {clear_breadcrumbs: true}); },
        "click .o_hr_attendance_sign_in_out_icon": function () {
            var self = this;
            this.$('.o_hr_attendance_sign_in_out_icon').attr("disabled", "disabled");
            var hr_employee = new Model('hr.employee');
            hr_employee.call('attendance_manual', [[this.employee_id], this.next_action])
            .then(function(result) {
                if (result.action) {
                    if (result.action['res_id']){
                        self.do_action({
                            type: 'ir.actions.act_window',
                            res_model: 'labor.mrp',
			                view_mode:'tree,form',
			                view_type:'form',
			                domain: [['employee_id', '=', self.employee_id]],
                            res_id: result.action['res_id'],
                            views: [[false,'list'],[false, 'form']],
                            target: 'current'
                        });
                    }
                    else {
                        self.do_action(result.action);
                    }
                } else if (result.warning) {
                    self.do_warn(result.warning);
                    self.$('.o_hr_attendance_sign_in_out_icon').removeAttr("disabled");
                }
            });
        },
        'click .o_hr_attendance_pin_pad_button_0': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 0); },
        'click .o_hr_attendance_pin_pad_button_1': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 1); },
        'click .o_hr_attendance_pin_pad_button_2': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 2); },
        'click .o_hr_attendance_pin_pad_button_3': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 3); },
        'click .o_hr_attendance_pin_pad_button_4': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 4); },
        'click .o_hr_attendance_pin_pad_button_5': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 5); },
        'click .o_hr_attendance_pin_pad_button_6': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 6); },
        'click .o_hr_attendance_pin_pad_button_7': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 7); },
        'click .o_hr_attendance_pin_pad_button_8': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 8); },
        'click .o_hr_attendance_pin_pad_button_9': function() { this.$('.o_hr_attendance_PINbox').val(this.$('.o_hr_attendance_PINbox').val() + 9); },
        'click .o_hr_attendance_pin_pad_button_C': function() { this.$('.o_hr_attendance_PINbox').val(''); },
        'click .o_hr_attendance_pin_pad_button_ok': function() {
            var self = this;
            this.$('.o_hr_attendance_pin_pad_button_ok').attr("disabled", "disabled");
            var hr_employee = new Model('hr.employee');
            hr_employee.call('attendance_manual', [[this.employee_id], this.next_action, this.$('.o_hr_attendance_PINbox').val()])
            .then(function(result) {
                if (result.action) {
                    self.do_action(result.action);
                } else if (result.warning) {
                    self.do_warn(result.warning);
                    setTimeout( function() { self.$('.o_hr_attendance_pin_pad_button_ok').removeAttr("disabled"); }, 500);
                }
            });
        },
    },
});

});
