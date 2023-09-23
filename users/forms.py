from django.contrib.auth.forms import PasswordChangeForm
from django.contrib.auth.models import User
from django import forms


class PasswordChangingForm(PasswordChangeForm):
    old_password = forms.CharField(label="Old password",max_length=50,widget=forms.PasswordInput(attrs={'class': 'form-control','type':'password'}))
    new_password1 = forms.CharField(label="New password",max_length=50, widget=forms.PasswordInput(attrs={'class': 'form-control','type':'password'}))
    new_password2 = forms.CharField(label="Confirm password",max_length=50, widget=forms.PasswordInput(attrs={'class': 'form-control','type':'password'}))

    class Meta:
        model = User
        fields = ('old_password', 'new_password1', 'new_password2')
