from django.urls import re_path

from . import views

urlpatterns = [
    re_path(r'^catalog/$', views.catalogs, name='catalog'),
    re_path(r'^get-drgr/?$', views.fetch_drugs_grades, name="get_dr_gr"),
    re_path(r'^get-evidence/?$', views.fetch_evidence, name="get_evidence"),
    re_path(r'^add-note/?$', views.add_note, name="add_note"),
    re_path(r'^del-note/?$', views.del_note, name="del_note"),
    re_path(r'^edit-note/?$', views.edit_note, name="edit_note"),

]
