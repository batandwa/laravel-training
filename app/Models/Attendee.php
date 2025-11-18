<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Attendee extends Model
{
    protected $fillable = ['event_id', 'name', 'email'];

    public function event()
    {
        return $this->belongsTo(Event::class);
    }
}
