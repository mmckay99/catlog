from django.urls import re_path
from catlog import views

# This two if you want to enable the Django Admin: (recommended)
from django.contrib import admin

urlpatterns = [
    re_path(r'^$', views.index, name='index'),
    re_path(r'^(?P<catlog_key>[\w-]+)/$', views.view_catlog_page, name='view_catlog_page'),
    re_path(r'^(?P<catlog_key>[\w-]+)/rows/all/$', views.all_rows, name='view_all_rows'),
    re_path(r'^(?P<catlog_key>[\w-]+)/rows/update/$', views.update_rows, name='view_update_rows')
]