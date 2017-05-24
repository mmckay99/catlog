from django.conf.urls import url
from catlog import views

# This two if you want to enable the Django Admin: (recommended)
from django.contrib import admin

urlpatterns = [
    url(r'^$', views.index, name='index'),
    url(r'^(?P<catlog_key>[\w-]+)/$', views.view_catlog_page, name='view_catlog_page'),
    url(r'^(?P<catlog_key>[\w-]+)/rows/all/$', views.all_rows, name='view_all_rows'),
    url(r'^(?P<catlog_key>[\w-]+)/rows/update/$', views.update_rows, name='view_update_rows')
]