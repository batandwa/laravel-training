<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    protected $fillable = ['title', 'location', 'event_date'];

    public function attendees()
    {
        return $this->hasMany(Attendee::class);
    }
}
