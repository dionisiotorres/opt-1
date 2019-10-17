# -*- coding: utf-8 -*-
##############################################################################
#
#    OpenERP, Open Source Management Solution
#    Copyright (C) 2004-2010 Tiny SPRL (<http://tiny.be>).
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU Affero General Public License as
#    published by the Free Software Foundation, either version 3 of the
#    License, or (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU Affero General Public License for more details.
#
#    You should have received a copy of the GNU Affero General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.
#
##############################################################################

{
    'name': 'library management',
    'version': '1.0',
    'author': 'GYB (Parth R Trivedi)',
    'website': 'www.gybitsolutions.com',
    'category': 'Library Demo for parth',
    'summary': '',
    'depends': ['sale'],
    'data': [
        'views/student_view.xml',        
        'views/book_view.xml',
        'views/book_issue_view.xml',
        'views/book_return_view.xml',
        'views/book_history.xml',
        'views/student_view_inherit.xml',

            
    ],
    'demo': [],
    
    'installable': True,
    'application': True,
    'auto_install': False,
}
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
