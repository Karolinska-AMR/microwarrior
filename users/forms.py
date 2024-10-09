from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.models import User
from django import forms
from django.utils.translation import gettext as _

class PasswordChangingForm(PasswordChangeForm):
    old_password = forms.CharField(label=_("Gammalt lösenord"),max_length=50,widget=forms.PasswordInput(attrs={'class': 'form-control','type':'password'}))
    new_password1 = forms.CharField(label=_("Nytt lösenord"),max_length=50, widget=forms.PasswordInput(attrs={'class': 'form-control','type':'password'}))
    new_password2 = forms.CharField(label=_("Bekräfta lösenord"),max_length=50, widget=forms.PasswordInput(attrs={'class': 'form-control','type':'password'}))

    class Meta:
        model = User
        fields = ('old_password', 'new_password1', 'new_password2')
