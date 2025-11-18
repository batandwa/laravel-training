<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Event;

class EventController extends Controller
{
    public function index()
    {
        return Event::all();
    }

    public function show($id)
    {
        return Event::with('attendees')->findOrFail($id);
    }

    public function store(Request $request)
    {
        $event = Event::create([
            'title' => $request->title,
            'location' => $request->location,
        ]);
        return response()->json($event, 201);
    }

    // public function update(Request $request)
    // {
    //     $event = Event::update($request->id, [
    //         'title' => $request->title,
    //         'location' => $request->location,
    //     ]);
    //     return response()->json($event, 200);
    // }
    public function update(Request $request)
    {
        // $event = Event::update($request->id, [
        //     'title' => $request->title,
        //     'location' => $request->location,
        // ]);
        $event = Event::find($request->id); 
        $updatedEvent = $event->update([
            'title' => $request->title,
            'location' => $request->location,
        ]);
        return response()->json($updatedEvent, 200);
    }
}
